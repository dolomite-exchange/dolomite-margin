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

import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { IIsolationModeUnwrapperTrader } from "../interfaces/IIsolationModeUnwrapperTrader.sol";
import { IIsolationModeWrapperTrader } from "../interfaces/IIsolationModeWrapperTrader.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { OnlyKeyringWhiteListed } from "../helpers/OnlyKeyringWhiteListed.sol";


/**
 * @title LiquidatorProxyV4WithGenericTrader
 * @author Dolomite
 *
 * Contract for liquidating accounts in DolomiteMargin using generic traders. This contract should presumably work with
 * any liquidation strategy due to its generic implementation. As such, tremendous care should be taken to ensure that
 * the `traders` array passed to the `liquidate` function is correct and will not result in any unexpected behavior
 * for special assets like IsolationMode tokens.
 */
contract LiquidatorProxyV4WithGenericTrader is
    HasLiquidatorRegistry,
    LiquidatorProxyBase,
    GenericTraderProxyBase,
    ReentrancyGuard,
    OnlyKeyringWhiteListed
{

    // ============ Constants ============

    bytes32 private constant FILE = "LiquidatorProxyV4";
    uint256 private constant LIQUID_ACCOUNT_ID = 2;

    // ============ Storage ============

    IExpiry public EXPIRY;
    IDolomiteMargin public DOLOMITE_MARGIN;

    // ============ Constructor ============

    constructor (
        uint256 _chainId,
        address _expiryProxy,
        address _dolomiteMargin,
        address _liquidatorAssetRegistry
    )
    public
    LiquidatorProxyBase(
        _chainId
    )
    GenericTraderProxyBase(
        _chainId
    )
    HasLiquidatorRegistry(
        _liquidatorAssetRegistry
    )
    {
        EXPIRY = IExpiry(_expiryProxy);
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    // ============ External Functions ============

    // solium-disable-next-line security/no-assign-params
    function liquidate(
        Account.Info memory _solidAccount,
        Account.Info memory _liquidAccount,
        uint256[] memory _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        TraderParam[] memory _tradersPath,
        Account.Info[] memory _makerAccounts,
        uint256 _expiry
    )
        public
        nonReentrant
        onlyKeyringWhiteListed()
    {
        GenericTraderProxyCache memory genericCache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN,
            eventEmitterRegistry: IEventEmitterRegistry(address(0)),
            // unused for this function
            isMarginDeposit: false,
            // unused for this function
            otherAccountNumber: 0,
            // traders go right after the liquid account ("other account")
            traderAccountStartIndex: LIQUID_ACCOUNT_ID + 1,
            actionsCursor: 0,
            // unused for this function
            inputBalanceWeiBeforeOperate: Types.zeroWei(),
            // unused for this function
            outputBalanceWeiBeforeOperate: Types.zeroWei(),
            // unused for this function
            transferBalanceWeiBeforeOperate: Types.zeroWei()
        });
        _validateMarketIdPath(_marketIdsPath);
        _validateAmountWeis(_inputAmountWei, _minOutputAmountWei);
        _validateTraderParams(
            genericCache,
            _marketIdsPath,
            _makerAccounts,
            _tradersPath
        );
        _validateInputAmountAndInputMarketForIsolationMode(_tradersPath[0], _inputAmountWei);

        // put all values that will not change into a single struct
        LiquidatorProxyConstants memory constants;
        constants.dolomiteMargin = genericCache.dolomiteMargin;
        constants.solidAccount = _solidAccount;
        constants.liquidAccount = _liquidAccount;
        constants.heldMarket = _marketIdsPath[0];
        constants.owedMarket = _marketIdsPath[_marketIdsPath.length - 1];

        _checkConstants(constants, _expiry);
        _validateAssetForLiquidation(constants.heldMarket);
        _validateAssetForLiquidation(constants.owedMarket);

        constants.liquidMarkets = constants.dolomiteMargin.getAccountMarketsWithBalances(constants.liquidAccount);
        constants.markets = _getMarketInfos(
            constants.dolomiteMargin,
            constants.dolomiteMargin.getAccountMarketsWithBalances(_solidAccount),
            constants.liquidMarkets
        );
        constants.expiryProxy = _expiry != 0 ? EXPIRY: IExpiry(address(0)); // don't read EXPIRY; it's not needed
        constants.expiry = uint32(_expiry);

        LiquidatorProxyCache memory liquidatorCache = _initializeCache(constants);

        // validate the msg.sender and that the expiration matches (if being used)
        _checkBasicRequirements(constants);

        // get the max liquidation amount
        _calculateAndSetMaxLiquidationAmount(liquidatorCache);

        _minOutputAmountWei = _calculateAndSetActualLiquidationAmount(_minOutputAmountWei, liquidatorCache);

        Account.Info[] memory accounts = _getAccounts(
            genericCache,
            _makerAccounts,
            _solidAccount.owner,
            _solidAccount.number
        );
        // the call to _getAccounts leaves accounts[LIQUID_ACCOUNT_ID] null because it fills in the traders starting at
        // the `traderAccountCursor` index
        accounts[LIQUID_ACCOUNT_ID] = _liquidAccount;
        _validateZapAccount(genericCache, accounts[ZAP_ACCOUNT_ID], _marketIdsPath);

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](
            /* liquidationActionsLength = */ 1 + _getActionsLengthForTraderParams(_tradersPath)
        );
        _appendLiquidationAction(
            actions,
            constants,
            liquidatorCache,
            genericCache
        );
        _appendTraderActions(
            accounts,
            actions,
            genericCache,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath
        );

        genericCache.dolomiteMargin.operate(accounts, actions);
    }

    // ============ Internal Functions ============

    function _validateInputAmountAndInputMarketForIsolationMode(
        TraderParam memory _param,
        uint256 _inputAmountWei
    ) internal pure {
        if (_isUnwrapperTraderType(_param.traderType) || _isWrapperTraderType(_param.traderType)) {
            // For liquidations, the asset amount must match the amount of collateral transferred from liquid account
            // to solid account. This is done via always selling the max amount of held collateral.
            Require.that(
                _inputAmountWei == uint256(-1),
                FILE,
                "Invalid amount for IsolationMode"
            );
        }
    }

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
        if (_constants.expiry != 0) {
            _actions[_genericCache.actionsCursor++] = AccountActionLib.encodeExpiryLiquidateAction(
                TRADE_ACCOUNT_ID,
                LIQUID_ACCOUNT_ID,
                _constants.owedMarket,
                _constants.heldMarket,
                address(_constants.expiryProxy),
                _constants.expiry,
                _liquidatorCache.solidHeldUpdateWithReward,
                _liquidatorCache.owedWeiToLiquidate,
                _liquidatorCache.flipMarketsForExpiration
            );
        } else {
            _actions[_genericCache.actionsCursor++] = AccountActionLib.encodeLiquidateAction(
                TRADE_ACCOUNT_ID,
                LIQUID_ACCOUNT_ID,
                _constants.owedMarket,
                _constants.heldMarket,
                _liquidatorCache.owedWeiToLiquidate
            );
        }
    }

    function _otherAccountId() internal pure returns (uint256) {
        return LIQUID_ACCOUNT_ID;
    }
}
