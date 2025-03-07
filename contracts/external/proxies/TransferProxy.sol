/*

    Copyright 2021 Dolomite.

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
import { Types } from "../../protocol/lib/Types.sol";
import { Require } from "../../protocol/lib/Require.sol";

import { AuthorizationBase } from "../helpers/AuthorizationBase.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";

import { ITransferProxy } from "../interfaces/ITransferProxy.sol";
import { OnlyKeyringWhiteListed } from "../helpers/OnlyKeyringWhiteListed.sol";


/**
 * @title TransferProxy
 * @author Dolomite
 *
 * Contract for sending internal balances within Dolomite to other users/margin accounts easily
 */
contract TransferProxy is ITransferProxy, AuthorizationBase, ReentrancyGuard, OnlyKeyringWhiteListed {

    // ============ Constants ============

    bytes32 private constant FILE = "TransferProxy";

    // ============ Constructor ============

    constructor (
        address _dolomiteMargin
    )
    public
    AuthorizationBase(_dolomiteMargin)
    {}

    // ============ External Functions ============

    function transfer(
        uint256 _fromAccountNumber,
        address _to,
        uint256 _toAccountNumber,
        address _token,
        uint256 _amountWei
    )
        external
        nonReentrant
        requireIsCallerAuthorized(msg.sender)
        onlyKeyringWhiteListed()
    {
        uint256[] memory markets = new uint256[](1);
        markets[0] = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amountWei;

        _transferMultiple(
            _fromAccountNumber,
            _to,
            _toAccountNumber,
            markets,
            amounts
        );
    }

    function transferMultiple(
        uint256 _fromAccountNumber,
        address _to,
        uint256 _toAccountNumber,
        address[] calldata _tokens,
        uint256[] calldata _amountsWei
    )
        external
        nonReentrant
        requireIsCallerAuthorized(msg.sender)
        onlyKeyringWhiteListed()
    {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN;
        uint256[] memory markets = new uint256[](_tokens.length);
        for (uint256 i; i < markets.length; ++i) {
            markets[i] = dolomiteMargin.getMarketIdByTokenAddress(_tokens[i]);
        }

        _transferMultiple(
            _fromAccountNumber,
            _to,
            _toAccountNumber,
            markets,
            _amountsWei
        );
    }

    function transferMultipleWithMarkets(
        uint256 _fromAccountNumber,
        address _to,
        uint256 _toAccountNumber,
        uint256[] calldata _markets,
        uint256[] calldata _amountsWei
    )
        external
        nonReentrant
        requireIsCallerAuthorized(msg.sender)
        onlyKeyringWhiteListed()
    {
        _transferMultiple(
            _fromAccountNumber,
            _to,
            _toAccountNumber,
            _markets,
            _amountsWei
        );
    }

    // ============ Internal Functions ============

    function _transferMultiple(
        uint256 _fromAccountNumber,
        address _to,
        uint256 _toAccountNumber,
        uint256[] memory _markets,
        uint256[] memory _amounts
    )
        internal
    {
        Require.that(
            _markets.length == _amounts.length,
            FILE,
            "invalid params length"
        );

        Account.Info[] memory accounts = new Account.Info[](2);
        accounts[0] = Account.Info(msg.sender, _fromAccountNumber);
        accounts[1] = Account.Info(_to, _toAccountNumber);

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](_markets.length);
        for (uint256 i; i < _markets.length; ++i) {
            actions[i] = AccountActionLib.encodeTransferAction(
                /* _fromAccountId = */ 0, // solhint-disable-line indent
                /* _fromAccountId = */ 1, // solhint-disable-line indent
                _markets[i],
                _amounts[i]
            );
        }

        DOLOMITE_MARGIN.operate(accounts, actions);
    }
}
