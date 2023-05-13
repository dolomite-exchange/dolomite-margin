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

import { Decimal } from "../lib/Decimal.sol";


/**
 * @title IAccountRiskOverrideGetter
 * @author Dolomite
 *
 * @notice Interface that can be implemented by any contract that needs to implement risk overrides for an account.
 */
interface IAccountRiskOverrideGetter {

    /**
     * @notice  Gets the risk overrides for a given account owner.
     *
     * @param   _accountOwner               The owner of the account whose risk override should be retrieved.
     * @return  marginRatioOverride         The margin ratio override for this account.
     * @return  liquidationSpreadOverride   The liquidation spread override for this account.
     */
    function getAccountRiskOverride(
        address _accountOwner
    )
        external
        view
        returns
    (
        Decimal.D256 memory marginRatioOverride,
        Decimal.D256 memory liquidationSpreadOverride
    );
}