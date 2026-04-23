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
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IBorrowPositionProxyV1 } from "../interfaces/IBorrowPositionProxyV1.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";



/**
 * @title   BorrowPositionProxyV1
 * @author  Dolomite
 *
 * @dev Proxy contract for opening borrow positions. This makes indexing easier and lowers gas costs on Arbitrum by
 *      minimizing call data
 */
contract BorrowPositionProxyV1 is IBorrowPositionProxyV1, OnlyKeyringWhiteListed {
    using Types for Types.Par;

    constructor (
        address dolomiteMargin
    )
    public
    OnlyDolomiteMargin(dolomiteMargin)
    {}

    function openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external onlyKeyringWhiteListed {
        // Emit this before the call to DolomiteMargin so indexers get it before the Transfer events are emitted
        emit BorrowPositionOpen(msg.sender, _toAccountNumber);

        _transferBetweenAccounts(
            _fromAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
    }

    function closeBorrowPosition(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    ) external onlyKeyringWhiteListed {
        Account.Info[] memory accounts = new Account.Info[](2);
        accounts[0] = Account.Info(msg.sender, _borrowAccountNumber);
        accounts[1] = Account.Info(msg.sender, _toAccountNumber);

        uint256 marketIdsLength = _collateralMarketIds.length;
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](marketIdsLength);
        for (uint256 i; i < marketIdsLength; ++i) {
            actions[i] = AccountActionLib.encodeTransferAction(
                /* _fromAccountId = */ 0, // solium-disable-line
                /* _toAccountId = */ 1, // solium-disable-line
                _collateralMarketIds[i],
                uint(- 1)
            );
        }

        DOLOMITE_MARGIN.operate(accounts, actions);
    }

    function transferBetweenAccounts(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external onlyKeyringWhiteListed {
        _transferBetweenAccounts(
            _fromAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
    }

    // solium-disable-next-line security/no-assign-params
    function repayAllForBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external onlyKeyringWhiteListed {
        // reverse the ordering of the `_borrowAccountNumber` and `_fromAccountNumber`, so using `Target = 0` calculates
        // on `_borrowAccountNumber`. We then need to reverse the `AccountBalanceLib.BalanceCheckFlag` if it's set to
        // `from` or `to`.
        if (_balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.To) {
            _balanceCheckFlag = AccountBalanceLib.BalanceCheckFlag.From;
        } else if (_balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From) {
            _balanceCheckFlag = AccountBalanceLib.BalanceCheckFlag.To;
        }

        AccountActionLib.transfer(
            DOLOMITE_MARGIN,
            /* _borrowAccountOwner = */ msg.sender, // solium-disable-line
            _borrowAccountNumber,
            /* _toAccountOwner = */ msg.sender, // solium-disable-line
            _fromAccountNumber,
            _marketId,
            Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Target,
                value: 0
            }),
            _balanceCheckFlag
        );
    }

    // ==================== Internal Functions ====================

    function _transferBetweenAccounts(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) internal {
        AccountActionLib.transfer(
            DOLOMITE_MARGIN,
            /* _fromAccountOwner = */ msg.sender, // solium-disable-line
            _fromAccountNumber,
            /* _toAccountOwner = */ msg.sender, // solium-disable-line
            _toAccountNumber,
            _marketId,
            Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: _amountWei
            }),
            _balanceCheckFlag
        );
    }
}
