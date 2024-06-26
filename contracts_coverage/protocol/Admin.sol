/*

    Copyright 2019 dYdX Trading Inc.

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

import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IAccountRiskOverrideSetter } from "./interfaces/IAccountRiskOverrideSetter.sol";
import { IDolomiteMargin } from "./interfaces/IDolomiteMargin.sol";
import { IInterestSetter } from "./interfaces/IInterestSetter.sol";
import { IOracleSentinel } from "./interfaces/IOracleSentinel.sol";
import { IPriceOracle } from "./interfaces/IPriceOracle.sol";

import { AdminImpl } from "./impl/AdminImpl.sol";

import { Decimal } from "./lib/Decimal.sol";
import { Interest } from "./lib/Interest.sol";
import { Monetary } from "./lib/Monetary.sol";
import { Token } from "./lib/Token.sol";

import { HasState } from "./HasState.sol";


/**
 * @title Admin
 * @author dYdX
 *
 * Public functions that allow the privileged owner address to manage DolomiteMargin
 */
contract Admin is
    IDolomiteMargin,
    HasState,
    Ownable,
    ReentrancyGuard
{
    // ============ Token Functions ============

    function ownerWithdrawExcessTokens(
        uint256 marketId,
        address recipient
    )
        public
        onlyOwner
        nonReentrant
        returns (uint256)
    {
        return AdminImpl.ownerWithdrawExcessTokens(
            g_state,
            marketId,
            recipient
        );
    }

    function ownerWithdrawUnsupportedTokens(
        address token,
        address recipient
    )
        public
        onlyOwner
        nonReentrant
        returns (uint256)
    {
        return AdminImpl.ownerWithdrawUnsupportedTokens(
            g_state,
            token,
            recipient
        );
    }

    // ============ Market Functions ============

    function ownerAddMarket(
        address token,
        IPriceOracle priceOracle,
        IInterestSetter interestSetter,
        Decimal.D256 memory marginPremium,
        Decimal.D256 memory spreadPremium,
        uint256 maxSupplyWei,
        uint256 maxBorrowWei,
        Decimal.D256 memory earningsRateOverride,
        bool isClosing
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerAddMarket(
            g_state,
            token,
            priceOracle,
            interestSetter,
            marginPremium,
            spreadPremium,
            maxSupplyWei,
            maxBorrowWei,
            earningsRateOverride,
            isClosing
        );
    }

    function ownerSetIsClosing(
        uint256 marketId,
        bool isClosing
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetIsClosing(
            g_state,
            marketId,
            isClosing
        );
    }

    function ownerSetPriceOracle(
        uint256 marketId,
        IPriceOracle priceOracle
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetPriceOracle(
            g_state,
            marketId,
            priceOracle
        );
    }

    function ownerSetInterestSetter(
        uint256 marketId,
        IInterestSetter interestSetter
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetInterestSetter(
            g_state,
            marketId,
            interestSetter
        );
    }

    function ownerSetMarginPremium(
        uint256 marketId,
        Decimal.D256 memory marginPremium
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetMarginPremium(
            g_state,
            marketId,
            marginPremium
        );
    }

    function ownerSetLiquidationSpreadPremium(
        uint256 marketId,
        Decimal.D256 memory liquidationSpreadPremium
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetLiquidationSpreadPremium(
            g_state,
            marketId,
            liquidationSpreadPremium
        );
    }

    function ownerSetMaxSupplyWei(
        uint256 marketId,
        uint256 maxSupplyWei
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetMaxSupplyWei(
            g_state,
            marketId,
            maxSupplyWei
        );
    }

    function ownerSetMaxBorrowWei(
        uint256 marketId,
        uint256 maxBorrowWei
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetMaxBorrowWei(
            g_state,
            marketId,
            maxBorrowWei
        );
    }

    function ownerSetEarningsRateOverride(
        uint256 marketId,
        Decimal.D256 memory earningsRateOverride
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetEarningsRateOverride(
            g_state,
            marketId,
            earningsRateOverride
        );
    }

    // ============ Risk Functions ============

    function ownerSetMarginRatio(
        Decimal.D256 memory ratio
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetMarginRatio(
            g_state,
            ratio
        );
    }

    function ownerSetLiquidationSpread(
        Decimal.D256 memory spread
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetLiquidationSpread(
            g_state,
            spread
        );
    }

    function ownerSetEarningsRate(
        Decimal.D256 memory earningsRate
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetEarningsRate(
            g_state,
            earningsRate
        );
    }

    function ownerSetMinBorrowedValue(
        Monetary.Value memory minBorrowedValue
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetMinBorrowedValue(
            g_state,
            minBorrowedValue
        );
    }

    function ownerSetAccountMaxNumberOfMarketsWithBalances(
        uint256 accountMaxNumberOfMarketsWithBalances
    )
    public
    onlyOwner
    nonReentrant
    {
        AdminImpl.ownerSetAccountMaxNumberOfMarketsWithBalances(
            g_state,
            accountMaxNumberOfMarketsWithBalances
        );
    }

    function ownerSetOracleSentinel(
        IOracleSentinel oracleSentinel
    )
    public
    onlyOwner
    nonReentrant
    {
        AdminImpl.ownerSetOracleSentinel(g_state, oracleSentinel);
    }

    function ownerSetCallbackGasLimit(
        uint256 callbackGasLimit
    )
    public
    onlyOwner
    nonReentrant
    {
        AdminImpl.ownerSetCallbackGasLimit(g_state, callbackGasLimit);
    }

    function ownerSetDefaultAccountRiskOverride(
        IAccountRiskOverrideSetter accountRiskOverrideSetter
    )
    public
    onlyOwner
    nonReentrant
    {
        AdminImpl.ownerSetDefaultAccountRiskOverride(g_state, accountRiskOverrideSetter);
    }

    function ownerSetAccountRiskOverride(
        address accountOwner,
        IAccountRiskOverrideSetter accountRiskOverrideSetter
    )
    public
    onlyOwner
    nonReentrant
    {
        AdminImpl.ownerSetAccountRiskOverride(g_state, accountOwner, accountRiskOverrideSetter);
    }

    // ============ Global Operator Functions ============

    function ownerSetGlobalOperator(
        address operator,
        bool approved
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetGlobalOperator(
            g_state,
            operator,
            approved
        );
    }

    function ownerSetAutoTraderSpecial(
        address autoTrader,
        bool special
    )
        public
        onlyOwner
        nonReentrant
    {
        AdminImpl.ownerSetAutoTraderSpecial(
            g_state,
            autoTrader,
            special
        );
    }
}
