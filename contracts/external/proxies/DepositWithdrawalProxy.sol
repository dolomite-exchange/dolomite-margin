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

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";

import { IDepositWithdrawalProxy } from "../interfaces/IDepositWithdrawalProxy.sol";
import { IWETH } from "../interfaces/IWETH.sol";
import { OnlyKeyringWhiteListed } from "../helpers/OnlyKeyringWhiteListed.sol";


/**
 * @title DepositWithdrawalProxy
 * @author Dolomite
 *
 * @dev Contract for depositing or withdrawing to/from Dolomite easily. This lowers gas costs on Arbitrum by minimizing
 *      callData
 */
contract DepositWithdrawalProxy is IDepositWithdrawalProxy, OnlyDolomiteMargin, ReentrancyGuard, OnlyKeyringWhiteListed {
    using Address for address payable;

    // ============ Constants ============

    bytes32 private constant FILE = "DepositWithdrawalProxy";

    // ============ Field Variables ============

    IWETH public WRAPPED_PAYABLE_TOKEN;
    uint256 public PAYABLE_MARKET_ID;
    bool public g_initialized;

    // ============ Modifiers ============

    modifier requireIsInitialized() {
        Require.that(
            g_initialized,
            FILE,
            "not initialized"
        );
        _;
    }

    // ============ Constructor ============

    constructor (
        address _dolomiteMargin
    )
    public
    OnlyDolomiteMargin(_dolomiteMargin)
    {}

    // ============ External Functions ============

    function() external payable {
        Require.that(
            msg.sender == address(WRAPPED_PAYABLE_TOKEN),
            FILE,
            "invalid Payable sender"
        );
    }

    function initializePayableMarket(
        address payable _payableToken
    ) external {
        Require.that(
            !g_initialized,
            FILE,
            "already initialized"
        );
        g_initialized = true;
        WRAPPED_PAYABLE_TOKEN = IWETH(_payableToken);
        PAYABLE_MARKET_ID = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_payableToken);
        WRAPPED_PAYABLE_TOKEN.approve(address(DOLOMITE_MARGIN), uint(-1));
    }

    function depositWei(
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei
    )
    external
    nonReentrant
    onlyKeyringWhiteListed() {
        AccountActionLib.deposit(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccount = */ msg.sender, // solium-disable-line indentation
            _toAccountNumber,
            _marketId,
            Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: _amountWei == uint(-1) ? _getSenderBalance(_marketId) : _amountWei
            })
        );
    }

    function depositPayable(
        uint256 _toAccountNumber
    )
    external
    payable
    requireIsInitialized
    nonReentrant
    onlyKeyringWhiteListed() {
        _wrap();
        AccountActionLib.deposit(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccount = */ address(this), // solium-disable-line indentation
            _toAccountNumber,
            PAYABLE_MARKET_ID,
            Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: msg.value
            })
        );
    }

    function depositWeiIntoDefaultAccount(
        uint256 _marketId,
        uint256 _amountWei
    )
    external
    nonReentrant
    onlyKeyringWhiteListed() {
        AccountActionLib.deposit(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccount = */ msg.sender, // solium-disable-line indentation
            /* _toAccountNumber = */ 0, // solium-disable-line indentation
            _marketId,
            Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: _amountWei == uint(-1) ? _getSenderBalance(_marketId) : _amountWei
            })
        );
    }

    function depositPayableIntoDefaultAccount()
    external
    payable
    requireIsInitialized
    nonReentrant
    onlyKeyringWhiteListed() {
        _wrap();
        AccountActionLib.deposit(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccount = */ address(this), // solium-disable-line indentation
            /* _toAccountNumber = */ 0, // solium-disable-line indentation
            PAYABLE_MARKET_ID,
            Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: msg.value
            })
        );
    }

    function withdrawWei(
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    nonReentrant
    onlyKeyringWhiteListed() {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            _fromAccountNumber,
            /* _toAccount = */ msg.sender, // solium-disable-line indentation
            _marketId,
            Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: _amountWei == uint(-1) ? Types.AssetReference.Target : Types.AssetReference.Delta,
                value: _amountWei == uint(-1) ? 0 : _amountWei
            }),
            _balanceCheckFlag
        );
    }

    function withdrawPayable(
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    requireIsInitialized
    nonReentrant
    onlyKeyringWhiteListed() {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            _fromAccountNumber,
            /* _toAccount = */ address(this), // solium-disable-line indentation
            PAYABLE_MARKET_ID,
            Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: _amountWei == uint(-1) ? Types.AssetReference.Target : Types.AssetReference.Delta,
                value: _amountWei == uint(-1) ? 0 : _amountWei
            }),
            _balanceCheckFlag
        );
        _unwrapAndSend();
    }

    function withdrawWeiFromDefaultAccount(
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    nonReentrant
    onlyKeyringWhiteListed() {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccountNumber = */ 0, // solium-disable-line indentation
            /* _toAccount = */ msg.sender, // solium-disable-line indentation
            _marketId,
            Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: _amountWei == uint(-1) ? Types.AssetReference.Target : Types.AssetReference.Delta,
                value: _amountWei == uint(-1) ? 0 : _amountWei
            }),
            _balanceCheckFlag
        );
    }

    function withdrawPayableFromDefaultAccount(
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    requireIsInitialized
    nonReentrant
    onlyKeyringWhiteListed() {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccountNumber = */ 0, // solium-disable-line indentation
            /* _toAccount = */ address(this), // solium-disable-line indentation
            PAYABLE_MARKET_ID,
            Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: _amountWei == uint(-1) ? Types.AssetReference.Target : Types.AssetReference.Delta,
                value: _amountWei == uint(-1) ? 0 : _amountWei
            }),
            _balanceCheckFlag
        );
        _unwrapAndSend();
    }

    // ========================= Par Functions =========================

    function depositPar(
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountPar
    )
    external
    nonReentrant
    onlyKeyringWhiteListed() {
        AccountActionLib.deposit(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccount = */ msg.sender, // solium-disable-line indentation
            _toAccountNumber,
            _marketId,
            Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Par,
                ref: Types.AssetReference.Delta,
                value: _amountPar
            })
        );
    }

    function depositParIntoDefaultAccount(
        uint256 _marketId,
        uint256 _amountPar
    )
    external
    nonReentrant
    onlyKeyringWhiteListed() {
        AccountActionLib.deposit(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccount = */ msg.sender, // solium-disable-line indentation
            /* _toAccountNumber = */ 0, // solium-disable-line indentation
            _marketId,
            Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Par,
                ref: Types.AssetReference.Delta,
                value: _amountPar
            })
        );
    }

    function withdrawPar(
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountPar,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    nonReentrant
    onlyKeyringWhiteListed() {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            _fromAccountNumber,
            /* _toAccount = */ msg.sender, // solium-disable-line indentation
            _marketId,
            Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Par,
                ref: _amountPar == uint(-1) ? Types.AssetReference.Target : Types.AssetReference.Delta,
                value: _amountPar == uint(-1) ? 0 : _amountPar
            }),
            _balanceCheckFlag
        );
    }

    function withdrawParFromDefaultAccount(
        uint256 _marketId,
        uint256 _amountPar,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    nonReentrant
    onlyKeyringWhiteListed() {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccountNumber = */ 0, // solium-disable-line indentation
            /* _toAccount = */ msg.sender, // solium-disable-line indentation
            _marketId,
            Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Par,
                ref: _amountPar == uint(-1) ? Types.AssetReference.Target : Types.AssetReference.Delta,
                value: _amountPar == uint(-1) ? 0 : _amountPar
            }),
            _balanceCheckFlag
        );
    }

    // ============ Internal Functions ============

    function _wrap() internal {
        WRAPPED_PAYABLE_TOKEN.deposit.value(msg.value)();
    }

    function _unwrapAndSend() internal {
        IWETH wrappedPayableToken = WRAPPED_PAYABLE_TOKEN;
        uint amount = wrappedPayableToken.balanceOf(address(this));
        wrappedPayableToken.withdraw(amount);
        msg.sender.sendValue(amount);
    }

    function _getSenderBalance(uint256 _marketId) internal view returns (uint) {
        return IERC20(DOLOMITE_MARGIN.getMarketTokenAddress(_marketId)).balanceOf(msg.sender);
    }
}
