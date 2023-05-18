/*

    Copyright 2022 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.5.7;
pragma experimental ABIEncoderV2;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { GenericTraderProxyBase } from "../helpers/GenericTraderProxyBase.sol";
import { HasLiquidatorRegistry } from "../helpers/HasLiquidatorRegistry.sol";
import { LiquidatorProxyBase } from "../helpers/LiquidatorProxyBase.sol";

import { IExpiry } from "../interfaces/IExpiry.sol";
import { ILiquidityTokenUnwrapperTrader } from "../interfaces/ILiquidityTokenUnwrapperTrader.sol";
import { ILiquidityTokenWrapperTrader } from "../interfaces/ILiquidityTokenWrapperTrader.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";

import { LiquidatorProxyV2WithExternalLiquidity } from "./LiquidatorProxyV2WithExternalLiquidity.sol";


/**
 * @title LiquidatorProxyV4WithExternalLiquidityToken
 * @author Dolomite
 *
 * Contract for liquidating accounts in DolomiteMargin using generic traders. This contract should presumably work with
 * any liquidation strategy due to its generic implementation.
 */
contract LiquidatorProxyV4WithLiquidityToken is
    HasLiquidatorRegistry,
    LiquidatorProxyBase,
    GenericTraderProxyBase,
    ReentrancyGuard
{

    // ============ Constants ============

    bytes32 private constant FILE = "LiquidatorProxyV4";

    // ============ Storage ============

    IExpiry public EXPIRY;
    IDolomiteMargin public DOLOMITE_MARGIN;

    // ============ Constructor ============

    constructor (
        address _expiryProxy,
        address _dolomiteMargin,
        address _liquidatorAssetRegistry
    )
    public
    HasLiquidatorRegistry(
        _liquidatorAssetRegistry
    )
    {
        EXPIRY = IExpiry(_expiryProxy);
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    // ============ External Functions ============

    function liquidate(
        Account.Info memory _solidAccount,
        Account.Info memory _liquidAccount,
        uint256[] memory _marketIdPath,
        uint256[] memory _amountWeisPath,
        TraderParam[] memory _tradersPath,
        uint256 _expiry
    )
        public
        nonReentrant
        requireIsAssetWhitelistedForLiquidation(_marketIdPath[0])
        requireIsAssetWhitelistedForLiquidation(_marketIdPath[_marketIdPath.length - 1])
    {
        GenericTraderProxyCache memory genericCache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN,
            // unused for this function
            isMarginDeposit: false,
            // unused for this function
            otherAccountNumber: 0,
            traderAccountsLength: 0,
            // traders go right after the liquid account ("other account")
            traderAccountStartIndex: 2,
            actionsCursor: 0,
            traderAccountCursor: 2,
            // unused for this function
            inputBalanceWeiBeforeOperate: Types.zeroWei(),
            // unused for this function
            outputBalanceWeiBeforeOperate: Types.zeroWei(),
            // unused for this function
            transferBalanceWeiBeforeOperate: Types.zeroWei()
        });
        _validateMarketIdPath(_marketIdPath);
        _validateAmountWeisPath(_marketIdPath, _amountWeisPath);
        _validateTraderParams(genericCache, _marketIdPath, _tradersPath);

        // put all values that will not change into a single struct
        LiquidatorProxyConstants memory constants;
        constants.dolomiteMargin = genericCache.dolomiteMargin;
        constants.solidAccount = _solidAccount;
        constants.liquidAccount = _liquidAccount;
        constants.heldMarket = _marketIdPath[0];
        constants.owedMarket = _marketIdPath[_marketIdPath.length - 1];

        _checkConstants(constants, _expiry);

        constants.liquidMarkets = constants.dolomiteMargin.getAccountMarketsWithBalances(constants.liquidAccount);
        constants.markets = _getMarketInfos(
            constants.dolomiteMargin,
            constants.dolomiteMargin.getAccountMarketsWithBalances(_solidAccount),
            constants.liquidMarkets
        );
        constants.expiryProxy = _expiry > 0 ? EXPIRY: IExpiry(address(0)); // don't read EXPIRY; it's not needed
        constants.expiry = uint32(_expiry);

        LiquidatorProxyCache memory liquidatorCache = _initializeCache(constants);

        // validate the msg.sender and that the liquidAccount can be liquidated
        _checkBasicRequirements(constants);

        // get the max liquidation amount
        _calculateAndSetMaxLiquidationAmount(liquidatorCache);

        _calculateAndSetActualLiquidationAmount(_amountWeisPath, liquidatorCache);

        Account.Info[] memory accounts = _getAccounts(
            genericCache,
            _tradersPath,
            _solidAccount.owner,
            _solidAccount.number
        );
        // the call to _getAccounts leaves accounts[1] null because it fills in the traders starting at the
        // `traderAccountCursor` index
        accounts[1] = _liquidAccount;

        uint256 liquidationActionsLength = 1;
        uint256 traderActionsLength = _getActionsLengthForTraderParams(_tradersPath);
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](liquidationActionsLength + traderActionsLength);
        _appendLiquidationAction(
            actions,
            constants,
            liquidatorCache,
            genericCache
        );
        _appendTraderActions(
            actions,
            genericCache,
            _marketIdPath,
            _amountWeisPath,
            _tradersPath,
            traderActionsLength
        );

        genericCache.dolomiteMargin.operate(accounts, actions);
    }

    // ============ Internal Functions ============

    function _appendLiquidationAction(
        Actions.ActionArgs[] memory _actions,
        LiquidatorProxyConstants memory _constants,
        LiquidatorProxyCache memory _liquidatorCache,
        GenericTraderProxyCache memory _genericCache
    )
        internal
        pure
    {
        // solidAccountId is always at index 0, liquidAccountId is always at index 1
        if (_constants.expiry > 0) {
            _actions[_genericCache.actionsCursor++] = AccountActionLib.encodeExpiryLiquidateAction(
                /* _solidAccountId = */ 0,
                /* _liquidAccountId = */ 1,
                _constants.owedMarket,
                _constants.heldMarket,
                address(_constants.expiryProxy),
                _constants.expiry,
                _liquidatorCache.owedWeiToLiquidate,
                _liquidatorCache.flipMarketsForExpiration
            );
        } else {
            _actions[_genericCache.actionsCursor++] = AccountActionLib.encodeLiquidateAction(
                /* _solidAccountId = */ 0,
                /* _liquidAccountId = */ 1,
                _constants.owedMarket,
                _constants.heldMarket,
                _liquidatorCache.owedWeiToLiquidate
            );
        }
    }
}
