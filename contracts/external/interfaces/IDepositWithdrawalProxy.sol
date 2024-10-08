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

import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


interface IDepositWithdrawalProxy {

    /**
     * @param _payableToken The wrapped payable token of the network. For example, WETH on Arbitrum.
     */
    function initializePayableMarket(
        address payable _payableToken
    ) external;

    /**
     * @param _toAccountNumber  The account number into which `msg.sender` will be depositing
     * @param _marketId         The ID of the market being deposited
     * @param _amountWei        The amount, in Wei, to deposit. Use `uint(-1)` to deposit `msg.sender`'s entire balance
     */
    function depositWei(
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei
    ) external;

    /**
     * Same as `depositWei` but converts the `msg.sender`'s sent Payable Currency into Wrapped Payable Token before depositing into `DolomiteMargin`.
     *
     * @param _toAccountNumber The account number into which `msg.sender` will be depositing
     */
    function depositPayable(
        uint256 _toAccountNumber
    ) external payable;

    /**
     * @dev Same as `depositWei` but defaults to account number 0 to save additional call data
     *
     * @param _marketId     The ID of the market being deposited
     * @param _amountWei    The amount, in Wei, to deposit. Use `uint(-1)` to deposit `msg.sender`'s entire balance
     */
    function depositWeiIntoDefaultAccount(
        uint256 _marketId,
        uint256 _amountWei
    ) external;

    /**
     * Same as `depositWeiIntoDefaultAccount` but converts the `msg.sender`'s sent Payable Currency into wrapped Payable Token before depositing into
     * `DolomiteMargin`.
     */
    function depositPayableIntoDefaultAccount() external payable;

    /**
     * @param _fromAccountNumber    The account number from which `msg.sender` will be withdrawing
     * @param _marketId             The ID of the market being withdrawn
     * @param _amountWei            The amount, in Wei, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire
     *                              balance
     * @param _balanceCheckFlag     Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that
     *                              `_fromAccountNumber` balance is non-negative after the withdrawal settles.
     */
    function withdrawWei(
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * Same as `withdrawWei` but for withdrawing the Payable Token of the network. The user will receive unwrapped
     * Payable Token from DolomiteMargin.
     *
     * @param _fromAccountNumber    The account number from which `msg.sender` will be withdrawing
     * @param _amountWei            The amount, in Wei, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire
     *                              balance.
     * @param _balanceCheckFlag     Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that
     *                              `_fromAccountNumber` balance is non-negative after the withdrawal settles.
     */
    function withdrawPayable(
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @dev Same as `withdrawWei` but defaults to account number 0 to save additional call data
     *
     * @param _marketId         The ID of the market being withdrawn
     * @param _amountWei        The amount, in Wei, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire
     *                          balance
     * @param _balanceCheckFlag Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that `_fromAccountNumber`
     *                          balance is non-negative after the withdrawal settles.
     */
    function withdrawWeiFromDefaultAccount(
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * Same as `withdrawWeiFromDefaultAccount` but for withdrawing the Payable Token for the network. The user will
     * receive unwrapped Payable Token from
     * DolomiteMargin.
     *
     * @param _amountWei        The amount, in Wei, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire
     *                          balance
     * @param _balanceCheckFlag Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that `_fromAccountNumber`
     *                          balance is non-negative after the withdrawal settles.
     */
    function withdrawPayableFromDefaultAccount(
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @param _toAccountNumber  The account number into which `msg.sender` will be depositing
     * @param _marketId         The ID of the market being deposited
     * @param _amountPar        The amount, in Par, to deposit.
     */
    function depositPar(
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountPar
    ) external;

    /**
     * @dev Same as `depositPar` but defaults to account number 0 to save additional call data
     *
     * @param _marketId     The ID of the market being deposited
     * @param _amountPar    The amount, in Par, to deposit.
     */
    function depositParIntoDefaultAccount(
        uint256 _marketId,
        uint256 _amountPar
    ) external;

    /**
     * @param _fromAccountNumber    The account number from which `msg.sender` will be withdrawing
     * @param _marketId             The ID of the market being withdrawn
     * @param _amountPar            The amount, in Par, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire
     *                              balance
     * @param _balanceCheckFlag     Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that
     *                              `_fromAccountNumber` balance is non-negative after the withdrawal settles.
     */
    function withdrawPar(
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountPar,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @dev Same as `withdrawPar` but defaults to account number 0 to save additional call data
     *
     * @param _marketId         The ID of the market being withdrawn
     * @param _amountPar        The amount, in Par, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire balance
     * @param _balanceCheckFlag Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that `_fromAccountNumber`
     *                          balance is non-negative after the withdrawal settles.
     */
    function withdrawParFromDefaultAccount(
        uint256 _marketId,
        uint256 _amountPar,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;
}
