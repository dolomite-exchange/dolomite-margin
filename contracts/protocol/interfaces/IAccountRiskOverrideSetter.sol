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

pragma solidity >=0.5.0;
pragma experimental ABIEncoderV2;

import { Account } from "../lib/Account.sol";
import { Decimal } from "../lib/Decimal.sol";


/**
 * @title IAccountRiskOverrideSetter
 * @author Dolomite
 *
 * @notice Interface that can be implemented by any contract that needs to implement risk overrides for an account.
 */
interface IAccountRiskOverrideSetter {

    /**
     * @notice  Gets the risk overrides for a given account owner. In the context of an operation, this function is
     *          called within `_verifyFinalState`, after all of the operation's actions have occurred. Thus, it is safe
     *          to read the account's state from Dolomite Margin's storage.
     *
     * @param   _account                    The account whose risk override should be retrieved.
     * @return  marginRatioOverride         The margin ratio override for this account.
     * @return  liquidationSpreadOverride   The liquidation spread override for this account.
     */
    function getAccountRiskOverride(
        Account.Info calldata _account
    )
        external
        view
        returns
    (
        Decimal.D256 memory marginRatioOverride,
        Decimal.D256 memory liquidationSpreadOverride
    );
}
