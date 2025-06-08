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

import { Math } from "@openzeppelin/contracts/math/Math.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import { IExternalCallback } from "../interfaces/IExternalCallback.sol";
import { Account } from "../lib/Account.sol";
import { ExcessivelySafeCall } from "../lib/ExcessivelySafeCall.sol";
import { DolomiteMarginMath } from "../lib/DolomiteMarginMath.sol";
import { Types } from "../lib/Types.sol";


library SafeExternalCallback {
    using Address for address;
    using ExcessivelySafeCall for address;

    // ============ Events ============

    event LogExternalCallbackSuccess(address indexed primaryAccountOwner, uint primaryAccountNumber);

    event LogExternalCallbackFailure(address indexed primaryAccountOwner, uint primaryAccountNumber, string reason);

    // ============ Functions ============

    function callInternalBalanceChangeIfNecessary(
        Account.Info memory _primaryAccount,
        Account.Info memory _secondaryAccount,
        uint256 _primaryMarket,
        Types.Wei memory _primaryDeltaWei,
        uint256 _secondaryMarket,
        Types.Wei memory _secondaryDeltaWei,
        uint256 _gasLimit
    ) internal {
        if (_gasLimit != 0 && _primaryAccount.owner.isContract()) {
            uint16 maxCopyBytes = 256;
            (bool isCallSuccessful, bytes memory result) = _primaryAccount.owner.excessivelySafeCall(
                /* _gas = */ Math.min(gasleft(), _gasLimit), // send, at most, `_gasLimit` to the callback
                maxCopyBytes, // receive at-most this many bytes worth of return data
                abi.encodeWithSelector(
                    IExternalCallback(_primaryAccount.owner).onInternalBalanceChange.selector,
                    _primaryAccount.number,
                    _secondaryAccount,
                    _primaryMarket,
                    _primaryDeltaWei,
                    _secondaryMarket,
                    _secondaryDeltaWei
                )
            );

            if (isCallSuccessful) {
                emit LogExternalCallbackSuccess(_primaryAccount.owner, _primaryAccount.number);
            } else {
                // For reversions:
                // - the first 4 bytes is the method ID
                // - the next 32 bytes is the offset (hardcoded 0x20)
                // - the next 32 bytes is the length of the string
                // Here is an example result. The first 68 bytes (136 hexadecimal characters) are the templated
                // 08c379a0                                                         // erroring method ID
                // 0000000000000000000000000000000000000000000000000000000000000020 // offset to where string is
                // 0000000000000000000000000000000000000000000000000000000000000001 // string length
                // 2100000000000000000000000000000000000000000000000000000000000000 // string itself - not templated
                if (result.length < 68) {
                    result = bytes("");
                } else {
                    // parse the result bytes error message into a human-readable string
                    uint length;
                    // solium-disable-next-line security/no-inline-assembly
                    assembly {
                        result := add(result, 0x04)
                        length := mload(add(result, 0x40))
                        if gt(length, sub(maxCopyBytes, 0x44)) {
                            // if the length from `result` is longer than the max length, subtract the 68 bytes
                            // from the maxCopyBytes
                            mstore(add(result, 0x40), sub(maxCopyBytes, 0x44))
                        }
                    }
                    result = bytes(abi.decode(result, (string)));
                }
                emit LogExternalCallbackFailure(
                    _primaryAccount.owner,
                    _primaryAccount.number,
                    string(result)
                );
            }
        }
    }
}
