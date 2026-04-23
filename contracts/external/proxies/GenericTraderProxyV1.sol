/*

    Copyright 2023 Dolomite.

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
import { Events } from "../../protocol/lib/Events.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { GenericTraderProxyBase } from "../helpers/GenericTraderProxyBase.sol";
import { HasLiquidatorRegistry } from "../helpers/HasLiquidatorRegistry.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { OnlyKeyringWhiteListed } from "../helpers/OnlyKeyringWhiteListed.sol";

import { IExpiry } from "../interfaces/IExpiry.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeUnwrapperTrader } from "../interfaces/IIsolationModeUnwrapperTrader.sol";
import { IIsolationModeWrapperTrader } from "../interfaces/IIsolationModeWrapperTrader.sol";
import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";

import { GenericTraderProxyV1Lib } from "./GenericTraderProxyV1Lib.sol";


/**
 * @title   GenericTraderProxyV1
 * @author  Dolomite
 *
 * @dev Proxy contract for trading any asset from msg.sender
 */
contract GenericTraderProxyV1 is IGenericTraderProxyV1, GenericTraderProxyBase, OnlyDolomiteMargin, ReentrancyGuard, OnlyKeyringWhiteListed {
    using Types for Types.Wei;

    // ============ Constants ============

    bytes32 private constant FILE = "GenericTraderProxyV1";
    uint256 private constant TRANSFER_ACCOUNT_ID = 2;

    // ============ Storage ============

    IExpiry public EXPIRY;
    IEventEmitterRegistry public EVENT_EMITTER_REGISTRY;

    // ============ Modifiers ============

    modifier notExpired(uint256 _deadline) {
        Require.that(
            _deadline >= block.timestamp,
            FILE,
            "Deadline expired",
            _deadline,
            block.timestamp
        );
        _;
    }

    // ============ Constructor ============

    constructor (
        uint256 _chainId,
        address _expiry,
        address _eventEmitterRegistry,
        address _dolomiteMargin
    )
    public
    GenericTraderProxyBase(
        _chainId
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    )
    {
        EXPIRY = IExpiry(_expiry);
        EVENT_EMITTER_REGISTRY = IEventEmitterRegistry(_eventEmitterRegistry);
    }

    // ============ Public Functions ============

    function ownerSetEventEmitterRegistry(
        address _eventEmitterRegistry
    )
        external
        onlyDolomiteMarginOwner(msg.sender)
    {
        EVENT_EMITTER_REGISTRY = IEventEmitterRegistry(_eventEmitterRegistry);
    }

    // solium-disable-next-line security/no-assign-params
    function swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] memory _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        TraderParam[] memory _tradersPath,
        Account.Info[] memory _makerAccounts,
        UserConfig memory _userConfig
    )
        public
        nonReentrant
        notExpired(_userConfig.deadline)
        onlyKeyringWhiteListed()
    {
        GenericTraderProxyCache memory cache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN,
            eventEmitterRegistry: EVENT_EMITTER_REGISTRY,
            // unused for this function
            isMarginDeposit: false,
            // unused for this function
            otherAccountNumber: 0,
            // traders go right after the trade account and zap account
            traderAccountStartIndex: ZAP_ACCOUNT_ID + 1,
            actionsCursor: 0,
            // unused for this function
            inputBalanceWeiBeforeOperate: Types.zeroWei(),
            // unused for this function
            outputBalanceWeiBeforeOperate: Types.zeroWei(),
            // unused for this function
            transferBalanceWeiBeforeOperate: Types.zeroWei()
        });

        _validateMarketIdPath(_marketIdsPath);
        _inputAmountWei = _getActualInputAmountWei(
            cache,
            _tradeAccountNumber,
            _marketIdsPath[0],
            _inputAmountWei
        );

        _validateAmountWeis(_inputAmountWei, _minOutputAmountWei);
        _validateTraderParams(
            cache,
            _marketIdsPath,
            _makerAccounts,
            _tradersPath
        );

        Account.Info[] memory accounts = _getAccounts(
            cache,
            _makerAccounts,
            /* _tradeAccountOwner = */ msg.sender, // solium-disable-line indentation
            _tradeAccountNumber
        );
        _validateZapAccount(cache, accounts[ZAP_ACCOUNT_ID], _marketIdsPath);

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](_getActionsLengthForTraderParams(_tradersPath));
        _appendTraderActions(
            accounts,
            actions,
            cache,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath
        );

        cache.dolomiteMargin.operate(accounts, actions);
        cache.eventEmitterRegistry.emitZapExecuted(
            msg.sender,
            _tradeAccountNumber,
            _marketIdsPath,
            _tradersPath
        );

        if (
            _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            // Check that the trader's balance is not negative for the input market
            AccountBalanceLib.verifyBalanceIsNonNegative(
                cache.dolomiteMargin,
                accounts[TRADE_ACCOUNT_ID].owner,
                accounts[TRADE_ACCOUNT_ID].number,
                _marketIdsPath[0]
            );
        }
    }

    // solium-disable-next-line security/no-assign-params
    function swapExactInputForOutputAndModifyPosition(
        uint256 _tradeAccountNumber,
        uint256[] memory _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        TraderParam[] memory _tradersPath,
        Account.Info[] memory _makerAccounts,
        TransferCollateralParam memory _transferCollateralParams,
        ExpiryParam memory _expiryParams,
        UserConfig memory _userConfig
    )
        public
        nonReentrant
        notExpired(_userConfig.deadline)
        onlyKeyringWhiteListed()
    {
        GenericTraderProxyCache memory cache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN,
            eventEmitterRegistry: EVENT_EMITTER_REGISTRY,
            isMarginDeposit: _tradeAccountNumber == _transferCollateralParams.toAccountNumber,
            otherAccountNumber: _tradeAccountNumber == _transferCollateralParams.toAccountNumber
                ? _transferCollateralParams.fromAccountNumber
                : _transferCollateralParams.toAccountNumber,
            // traders go right after the trade account, the zap account, and the transfer account ("other account")
            traderAccountStartIndex: TRANSFER_ACCOUNT_ID + 1,
            actionsCursor: 0,
            inputBalanceWeiBeforeOperate: Types.zeroWei(),
            outputBalanceWeiBeforeOperate: Types.zeroWei(),
            transferBalanceWeiBeforeOperate: Types.zeroWei()
        });

        _validateMarketIdPath(_marketIdsPath);
        _validateTransferParams(cache, _transferCollateralParams, _tradeAccountNumber);

        // If we're transferring into the trade account and the input market is the transfer amount, we check the input
        // amount using the amount being transferred in
        if (
            _transferCollateralParams.toAccountNumber == _tradeAccountNumber
                && _marketIdsPath[0] == _transferCollateralParams.transferAmounts[0].marketId
        ) {
            _inputAmountWei = _getActualInputAmountWei(
                cache,
                _transferCollateralParams.fromAccountNumber,
                _marketIdsPath[0],
                _transferCollateralParams.transferAmounts[0].amountWei
            );
        } else {
            _inputAmountWei = _getActualInputAmountWei(
                cache,
                _tradeAccountNumber,
                _marketIdsPath[0],
                _inputAmountWei
            );
        }

        _validateAmountWeis(_inputAmountWei, _minOutputAmountWei);
        _validateTraderParams(
            cache,
            _marketIdsPath,
            _makerAccounts,
            _tradersPath
        );

        Account.Info[] memory accounts = _getAccounts(
            cache,
            _makerAccounts,
            /* _tradeAccountOwner = */ msg.sender, // solium-disable-line indentation
            _tradeAccountNumber
        );
        // the call to `_getAccounts` leaves accounts[TRANSFER_ACCOUNT_ID] unset, because it only fills in the traders
        // starting at the `traderAccountCursor` index
        accounts[TRANSFER_ACCOUNT_ID] = Account.Info({
            owner: msg.sender,
            number: cache.otherAccountNumber
        });
        _validateZapAccount(cache, accounts[ZAP_ACCOUNT_ID], _marketIdsPath);

        uint256 transferActionsLength = _getActionsLengthForTransferCollateralParam(_transferCollateralParams);
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](
            _getActionsLengthForTraderParams(_tradersPath)
                + transferActionsLength
                + _getActionsLengthForExpiryParam(_expiryParams)
        );

        // solium-disable indentation
        {
            // To avoid the "stack too deep" error, we rearrange the stack
            uint256[] memory marketIdsPathForStackTooDeep = _marketIdsPath;
            uint256 inputAmountWeiForStackTooDeep = _inputAmountWei;
            uint256 minOutputAmountWeiForStackTooDeep = _minOutputAmountWei;
            TraderParam[] memory tradersPathForStackTooDeep = _tradersPath;
            _appendTraderActions(
                accounts,
                actions,
                cache,
                marketIdsPathForStackTooDeep,
                inputAmountWeiForStackTooDeep,
                minOutputAmountWeiForStackTooDeep,
                tradersPathForStackTooDeep
            );
        }
        {
            // To avoid the "stack too deep" error, we rearrange the stack
            uint256 lastMarketId = _marketIdsPath[_marketIdsPath.length - 1];
            uint256 tradeAccountNumberForStackTooDeep = _tradeAccountNumber;
            _appendTransferActions(
                actions,
                cache,
                _transferCollateralParams,
                tradeAccountNumberForStackTooDeep,
                transferActionsLength,
                lastMarketId
            );
        }
        // solium-enable indentation
        _appendExpiryActions(
            actions,
            cache,
            _expiryParams,
            /* _tradeAccount = */ accounts[TRADE_ACCOUNT_ID] // solium-disable-line indentation
        );

        // snapshot the balances before so they can be logged in `_logEvents`
        _snapshotBalancesInCache(
            cache,
            /* _tradeAccount = */ accounts[TRADE_ACCOUNT_ID], // solium-disable-line indentation
            _marketIdsPath,
            _transferCollateralParams
        );

        GenericTraderProxyV1Lib.logBeforeZapEvents(
            cache,
            accounts[TRADE_ACCOUNT_ID],
            _userConfig.eventType
        );

        cache.dolomiteMargin.operate(accounts, actions);

        // solium-disable indentation
        {
            uint256[] memory marketIdsPathForStackTooDeep = _marketIdsPath;
            GenericTraderProxyV1Lib.logAfterZapEvents(
                cache,
                accounts[TRADE_ACCOUNT_ID],
                marketIdsPathForStackTooDeep,
                _tradersPath,
                _transferCollateralParams,
                _userConfig.eventType
            );
        }
        // solium-enable indentation

        if (
            _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            // Check that the trader's balance is not negative for the input market
            uint256 inputMarketId = _marketIdsPath[0];
            AccountBalanceLib.verifyBalanceIsNonNegative(
                cache.dolomiteMargin,
                accounts[TRADE_ACCOUNT_ID].owner,
                accounts[TRADE_ACCOUNT_ID].number,
                inputMarketId
            );
        }

        if (
            _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.To
        ) {
            uint256 length = _transferCollateralParams.transferAmounts.length;
            for (uint256 i; i < length; ++i) {
                AccountBalanceLib.verifyBalanceIsNonNegative(
                    cache.dolomiteMargin,
                    accounts[TRANSFER_ACCOUNT_ID].owner,
                    accounts[TRANSFER_ACCOUNT_ID].number,
                    _transferCollateralParams.transferAmounts[i].marketId
                );
            }
        }
    }

    // ============ Internal Functions ============

    function _appendExpiryActions(
        Actions.ActionArgs[] memory _actions,
        GenericTraderProxyCache memory _cache,
        ExpiryParam memory _param,
        Account.Info memory _tradeAccount
    )
    internal
    view
    {
        if (_param.expiryTimeDelta == 0) {
            // Don't append it if there's no expiry
            return;
        }

        _actions[_cache.actionsCursor++] = AccountActionLib.encodeExpirationAction(
            _tradeAccount,
            TRADE_ACCOUNT_ID,
            _param.marketId,
            address(EXPIRY),
            _param.expiryTimeDelta
        );
    }

    function _snapshotBalancesInCache(
        GenericTraderProxyCache memory _cache,
        Account.Info memory _tradeAccount,
        uint256[] memory _marketIdsPath,
        TransferCollateralParam memory _param
    ) internal view {
        _cache.inputBalanceWeiBeforeOperate = _cache.dolomiteMargin.getAccountWei(
            _tradeAccount,
            _marketIdsPath[0]
        );
        _cache.outputBalanceWeiBeforeOperate = _cache.dolomiteMargin.getAccountWei(
            _tradeAccount,
            _marketIdsPath[_marketIdsPath.length - 1]
        );
        _cache.transferBalanceWeiBeforeOperate = _cache.dolomiteMargin.getAccountWei(
            _tradeAccount,
            _param.transferAmounts[0].marketId
        );
    }

    function _getActualInputAmountWei(
        GenericTraderProxyCache memory _cache,
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _inputAmountWei
    ) internal view returns (uint256) {
        if (_inputAmountWei != uint256(-1)) {
            return _inputAmountWei;
        }

        Types.Wei memory balanceWei = _cache.dolomiteMargin.getAccountWei(
            Account.Info({
                owner: msg.sender,
                number: _accountNumber
            }),
            _marketId
        );
        Require.that(
            !balanceWei.isNegative(),
            FILE,
            "Balance must be positive",
            _marketId
        );
        return balanceWei.value;
    }

    function _appendTransferActions(
        Actions.ActionArgs[] memory _actions,
        GenericTraderProxyCache memory _cache,
        TransferCollateralParam memory _transferCollateralParam,
        uint256 _traderAccountNumber,
        uint256 _transferActionsLength,
        uint256 _lastMarketId
    )
    internal
    view
    {
        // the `_traderAccountNumber` is always `accountId=0`
        uint256 fromAccountId = _transferCollateralParam.fromAccountNumber == _traderAccountNumber
            ? TRADE_ACCOUNT_ID
            : TRANSFER_ACCOUNT_ID;

        uint256 toAccountId = _transferCollateralParam.fromAccountNumber == _traderAccountNumber
            ? TRANSFER_ACCOUNT_ID
            : TRADE_ACCOUNT_ID;

        for (uint256 i; i < _transferActionsLength; i++) {
            if (_transferCollateralParam.transferAmounts[i].amountWei == uint256(-2)) {
                Require.that(
                    _transferCollateralParam.transferAmounts[i].marketId == _lastMarketId,
                    FILE,
                    "Invalid transfer marketId",
                    _transferCollateralParam.transferAmounts[i].marketId
                );
                Require.that(
                    fromAccountId == TRADE_ACCOUNT_ID,
                    FILE,
                    "Invalid from account ID"
                );

                // We transfer to the amount we had before the swap finished
                _actions[_cache.actionsCursor++] = AccountActionLib.encodeTransferToTargetAmountAction(
                    fromAccountId,
                    toAccountId,
                    _transferCollateralParam.transferAmounts[i].marketId,
                    _cache.dolomiteMargin.getAccountWei(
                        Account.Info({
                            owner: msg.sender,
                            number: _transferCollateralParam.fromAccountNumber
                        }),
                        _transferCollateralParam.transferAmounts[i].marketId
                    )
                );
            } else {
                _actions[_cache.actionsCursor++] = AccountActionLib.encodeTransferAction(
                    fromAccountId,
                    toAccountId,
                    _transferCollateralParam.transferAmounts[i].marketId,
                    _transferCollateralParam.transferAmounts[i].amountWei
                );
            }
        }
    }

    function _validateTransferParams(
        GenericTraderProxyCache memory _cache,
        TransferCollateralParam memory _param,
        uint256 _tradeAccountNumber
    )
        internal
        pure
    {
        Require.that(
            _param.transferAmounts.length != 0,
            FILE,
            "Invalid transfer amounts length"
        );
        Require.that(
            _param.fromAccountNumber != _param.toAccountNumber,
            FILE,
            "Cannot transfer to same account"
        );
        Require.that(
            _tradeAccountNumber == _param.fromAccountNumber ||  _tradeAccountNumber == _param.toAccountNumber,
            FILE,
            "Invalid trade account number"
        );
        _cache.otherAccountNumber = _tradeAccountNumber == _param.toAccountNumber
            ? _param.fromAccountNumber
            : _param.toAccountNumber;

        uint256 length = _param.transferAmounts.length;
        for (uint256 i; i < length; ++i) {
            Require.that(
                _param.transferAmounts[i].amountWei != 0,
                FILE,
                "Invalid transfer amount at index",
                i
            );
        }
    }

    function _getActionsLengthForTransferCollateralParam(
        TransferCollateralParam memory _param
    )
        internal
        pure
        returns (uint256)
    {
        return _param.transferAmounts.length;
    }

    function _getActionsLengthForExpiryParam(
        ExpiryParam memory _param
    )
        internal
        pure
        returns (uint256)
    {
        if (_param.expiryTimeDelta == 0) {
            return 0;
        } else {
            return 1;
        }
    }

    function _otherAccountId() internal pure returns (uint256) {
        return TRADE_ACCOUNT_ID;
    }
}
