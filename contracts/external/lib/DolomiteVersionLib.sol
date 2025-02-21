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

import { Account } from "../../protocol/lib/Account.sol";
import { Decimal } from "../../protocol/lib/Decimal.sol";
import { Monetary } from "../../protocol/lib/Monetary.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";


/**
 * @title DolomiteVersionLib
 * @author Dolomite
 *
 * Library contract that has various utility functions for margin positions/accounts
 */
library DolomiteVersionLib {

    // ============ Constants ============

    bytes32 private constant FILE = "DolomiteVersionLib";
    uint256 private constant ARBITRUM_ONE = 42161;

    // ============ Functions ============

    function getLiquidationSpreadForChainAndPair(
        IDolomiteMargin _dolomiteMargin,
        uint256 _chainId,
        Account.Info memory _liquidAccount,
        uint256 _heldMarketId,
        uint256 _owedMarketId
    ) internal view returns (Decimal.D256 memory) {
        if (_chainId == ARBITRUM_ONE) {
            return _dolomiteMargin.getLiquidationSpreadForPair(_heldMarketId, _owedMarketId);
        } else {
            return _dolomiteMargin.getLiquidationSpreadForAccountAndPair(
                _liquidAccount,
                _heldMarketId,
                _owedMarketId
            );
        }
    }

    function getExpirySpreadAdjustedPricesForChain(
        IExpiry _expiry,
        uint256 _chainId,
        Account.Info memory _liquidAccount,
        uint256 _heldMarketId,
        uint256 _owedMarketId,
        uint32 _expiration
    ) internal view returns (
        Monetary.Price memory heldPrice,
        Monetary.Price memory owedPriceAdj
    ) {
        if (_chainId == ARBITRUM_ONE) {
            (heldPrice, owedPriceAdj) = _expiry.getSpreadAdjustedPrices(
                _heldMarketId,
                _owedMarketId,
                _expiration
            );
        } else {
            (heldPrice, owedPriceAdj) = _expiry.getLiquidationSpreadAdjustedPrices(
                _liquidAccount,
                _heldMarketId,
                _owedMarketId,
                _expiration
            );
        }
    }
}
