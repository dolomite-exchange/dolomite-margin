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

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Decimal } from "../../protocol/lib/Decimal.sol";
import { Interest } from "../../protocol/lib/Interest.sol";
import { DolomiteMarginMath } from "../../protocol/lib/DolomiteMarginMath.sol";
import { Monetary } from "../../protocol/lib/Monetary.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { HasLiquidatorRegistry } from "../helpers/HasLiquidatorRegistry.sol";
import { LiquidatorProxyBase } from "../helpers/LiquidatorProxyBase.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { OnlyKeyringWhiteListed } from "../helpers/OnlyKeyringWhiteListed.sol";


/**
 * @title LiquidatorProxyV1
 * @author dYdX
 *
 * Contract for liquidating other accounts in DolomiteMargin.
 */
contract LiquidatorProxyV1 is OnlyDolomiteMargin, ReentrancyGuard, LiquidatorProxyBase, OnlyKeyringWhiteListed {
    using DolomiteMarginMath for uint256;
    using SafeMath for uint256;
    using Types for Types.Par;
    using Types for Types.Wei;

    // ============ Constants ============

    bytes32 private constant FILE = "LiquidatorProxyV1";

    // ============ Structs ============

    struct LiquidatorProxyV1Constants {
        IDolomiteMargin dolomiteMargin;
        Account.Info solidAccount;
        Account.Info liquidAccount;
        Decimal.D256 minLiquidatorRatio;
        MarketInfo[] markets;
        uint256[] liquidMarkets;
    }

    struct LiquidatorProxyV1Cache {
        // mutable
        uint256 toLiquidate;
        Types.Wei heldWei;
        Types.Wei owedWei;
        uint256 supplyValue;
        uint256 borrowValue;

        // immutable
        Decimal.D256 spread;
        uint256 heldMarket;
        uint256 owedMarket;
        uint256 heldPrice;
        uint256 owedPrice;
        uint256 owedPriceAdj;
    }

    // ============ Constructor ============

    constructor (
        uint256 _chainId,
        address _liquidatorAssetRegistry,
        address _dolomiteMargin
    )
        public
        LiquidatorProxyBase(_chainId)
        HasLiquidatorRegistry(_liquidatorAssetRegistry)
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        /* solium-disable-line no-empty-blocks */
    }

    // ============ Public Functions ============

    /**
     * Liquidate liquidAccount using solidAccount. This contract and the msg.sender to this contract
     * must both be operators for the solidAccount.
     *
     * @param _solidAccount         The account that will do the liquidating
     * @param _liquidAccount        The account that will be liquidated
     * @param _minLiquidatorRatio   The minimum collateralization ratio to leave the solidAccount at. Setting this value
     *                              to `150000000000000000` is analogous to a 115% collateralization ratio.
     * @param _owedPreferences      Ordered list of markets to repay first
     * @param _heldPreferences      Ordered list of markets to receive payout for first
     */
    function liquidate(
        Account.Info memory _solidAccount,
        Account.Info memory _liquidAccount,
        Decimal.D256 memory _minLiquidatorRatio,
        uint256 _minValueLiquidated,
        uint256[] memory _owedPreferences,
        uint256[] memory _heldPreferences
    )
        public
        nonReentrant
        requireIsAssetsWhitelistedForLiquidation(_owedPreferences)
        requireIsAssetsWhitelistedForLiquidation(_heldPreferences)
        onlyKeyringWhiteListed()
    {
        // put all values that will not change into a single struct
        LiquidatorProxyV1Constants memory constants;
        constants.dolomiteMargin = DOLOMITE_MARGIN;
        constants.solidAccount = _solidAccount;
        constants.liquidAccount = _liquidAccount;
        constants.minLiquidatorRatio = _minLiquidatorRatio;
        constants.liquidMarkets = constants.dolomiteMargin.getAccountMarketsWithBalances(_liquidAccount);
        constants.markets = _getMarketInfos(
            constants.dolomiteMargin,
            constants.dolomiteMargin.getAccountMarketsWithBalances(_solidAccount),
            constants.liquidMarkets
        );

        // validate the msg.sender and that the liquidAccount can be liquidated
        _checkRequirements(constants);

        // keep a running tally of how much value will be attempted to be liquidated
        uint256 totalValueLiquidated = 0;

        // for each owedMarket
        for (uint256 owedIndex; owedIndex < _owedPreferences.length; ++owedIndex) {
            uint256 owedMarket = _owedPreferences[owedIndex];

            // for each heldMarket
            for (uint256 heldIndex; heldIndex < _heldPreferences.length; ++heldIndex) {
                uint256 heldMarket = _heldPreferences[heldIndex];

                // cannot use the same market
                if (heldMarket == owedMarket) {
                    continue;
                }

                // cannot liquidate non-negative markets
                if (!constants.dolomiteMargin.getAccountPar(_liquidAccount, owedMarket).isNegative()) {
                    break;
                }

                // cannot use non-positive markets as collateral
                if (!constants.dolomiteMargin.getAccountPar(_liquidAccount, heldMarket).isPositive()) {
                    continue;
                }

                // get all relevant values
                LiquidatorProxyV1Cache memory cache = _initializeCache(constants, heldMarket, owedMarket);

                // get the liquidation amount (before liquidator decreases in collateralization)
                _calculateSafeLiquidationAmount(cache);

                // get the max liquidation amount (before liquidator reaches minLiquidatorRatio)
                _calculateMaxLiquidationAmount(constants, cache);

                // if nothing to liquidate, do nothing
                if (cache.toLiquidate == 0) {
                    continue;
                }

                // execute the liquidations
                constants.dolomiteMargin.operate(
                    _constructAccountsArray(constants),
                    _constructActionsArray(cache)
                );

                // increment the total value liquidated
                totalValueLiquidated = totalValueLiquidated.add(cache.toLiquidate.mul(cache.owedPrice));
            }
        }

        // revert if liquidator account does not have a lot of overhead to liquidate these pairs
        Require.that(
            totalValueLiquidated >= _minValueLiquidated,
            FILE,
            "Not enough liquidatable value",
            totalValueLiquidated,
            _minValueLiquidated
        );
    }

    // ============ Private Functions ============

    /**
     * Calculate the owedAmount that can be liquidated until the liquidator account will be left
     * with BOTH a non-negative balance of heldMarket AND a non-positive balance of owedMarket.
     * This is the amount that can be liquidated until the collateralization of the liquidator
     * account will begin to decrease.
     */
    function _calculateSafeLiquidationAmount(
        LiquidatorProxyV1Cache memory _cache
    )
        private
        pure
    {
        bool negOwed = !_cache.owedWei.isPositive();
        bool posHeld = !_cache.heldWei.isNegative();

        // owedWei is already negative and heldWei is already positive
        if (negOwed && posHeld) {
            return;
        }

        // true if it takes longer for the liquidator owed balance to become negative than it takes
        // the liquidator held balance to become positive.
        bool owedGoesToZeroLast;
        if (negOwed) {
            owedGoesToZeroLast = false;
        } else if (posHeld) {
            owedGoesToZeroLast = true;
        } else {
            // owed is still positive and held is still negative
            owedGoesToZeroLast = _cache.owedWei.value.mul(_cache.owedPriceAdj) > _cache.heldWei.value.mul(_cache.heldPrice);
        }

        if (owedGoesToZeroLast) {
            // calculate the change in heldWei to get owedWei to zero
            Types.Wei memory heldWeiDelta = Types.Wei({
                sign: _cache.owedWei.sign,
                value: _cache.owedWei.value.getPartial(_cache.owedPriceAdj, _cache.heldPrice)
            });
            _setCacheWeiValues(
                _cache,
                _cache.heldWei.add(heldWeiDelta),
                Types.zeroWei()
            );
        } else {
            // calculate the change in owedWei to get heldWei to zero
            Types.Wei memory owedWeiDelta = Types.Wei({
                sign: _cache.heldWei.sign,
                value: _cache.heldWei.value.getPartial(_cache.heldPrice, _cache.owedPriceAdj)
            });
            _setCacheWeiValues(
                _cache,
                Types.zeroWei(),
                _cache.owedWei.add(owedWeiDelta)
            );
        }
    }

    /**
     * Calculate the additional owedAmount that can be liquidated until the collateralization of the
     * liquidator account reaches the minLiquidatorRatio. By this point, the cache will be set such
     * that the amount of owedMarket is non-positive and the amount of heldMarket is non-negative.
     */
    function _calculateMaxLiquidationAmount(
        LiquidatorProxyV1Constants memory _constants,
        LiquidatorProxyV1Cache memory _cache
    )
        private
        pure
    {
        assert(!_cache.heldWei.isNegative());
        assert(!_cache.owedWei.isPositive());

        // if the liquidator account is already not above the collateralization requirement, return
        bool liquidatorAboveCollateralization = _isCollateralized(
            _cache.supplyValue,
            _cache.borrowValue,
            _constants.minLiquidatorRatio
        );
        if (!liquidatorAboveCollateralization) {
            _cache.toLiquidate = 0;
            return;
        }

        // find the value difference between the current margin and the margin at minLiquidatorRatio
        uint256 requiredOverhead = Decimal.mul(_cache.borrowValue, _constants.minLiquidatorRatio);
        uint256 requiredSupplyValue = _cache.borrowValue.add(requiredOverhead);
        uint256 remainingValueBuffer = _cache.supplyValue.sub(requiredSupplyValue);

        // get the absolute difference between the minLiquidatorRatio and the liquidation spread
        Require.that(
            _constants.minLiquidatorRatio.value >= _cache.spread.value,
            FILE,
            "Min liquidator ratio too low"
        );
        Decimal.D256 memory spreadMarginDiff = Decimal.D256({
            value: _constants.minLiquidatorRatio.value.sub(_cache.spread.value)
        });

        // get the additional value of owedToken I can borrow to liquidate this position
        uint256 owedValueToTakeOn = Decimal.div(remainingValueBuffer, spreadMarginDiff);

        // get the additional amount of owedWei to liquidate
        uint256 owedWeiToLiquidate = owedValueToTakeOn.div(_cache.owedPrice);

        // store the additional amount in the cache
        _cache.toLiquidate = _cache.toLiquidate.add(owedWeiToLiquidate);
    }

    /**
     * Make some basic checks before attempting to liquidate an account.
     *  - Require that the msg.sender has the permission to use the liquidator account
     *  - Require that the liquid account is liquidatable
     */
    function _checkRequirements(
        LiquidatorProxyV1Constants memory _constants
    )
        private
        view
    {
        // check credentials for msg.sender
        Require.that(
            _constants.solidAccount.owner == msg.sender
            || _constants.dolomiteMargin.getIsLocalOperator(_constants.solidAccount.owner, msg.sender),
            FILE,
            "Sender not operator",
            msg.sender
        );

        // require that the liquidAccount is liquidatable
        (
            Monetary.Value memory liquidSupplyValue,
            Monetary.Value memory liquidBorrowValue
        ) = _getAdjustedAccountValues(
            _constants.dolomiteMargin,
            _constants.markets,
            _constants.liquidAccount,
            _constants.liquidMarkets,
            _constants.dolomiteMargin.getMarginRatioOverrideByAccount(_constants.liquidAccount)
        );
        Require.that(
            liquidSupplyValue.value != 0,
            FILE,
            "Liquid account no supply"
        );
        Require.that(
            _constants.dolomiteMargin.getAccountStatus(_constants.liquidAccount) == Account.Status.Liquid ||
            !_isCollateralized(
                liquidSupplyValue.value,
                liquidBorrowValue.value,
                _constants.dolomiteMargin.getMarginRatioForAccount(_constants.liquidAccount)
            ),
            FILE,
            "Liquid account not liquidatable",
            liquidSupplyValue.value,
            liquidBorrowValue.value
        );
    }

    /**
     * Changes the cache values to reflect changing the heldWei and owedWei of the liquidator
     * account. Changes toLiquidate, heldWei, owedWei, supplyValue, and borrowValue.
     */
    function _setCacheWeiValues(
        LiquidatorProxyV1Cache memory _cache,
        Types.Wei memory _newHeldWei,
        Types.Wei memory _newOwedWei
    )
        private
        pure
    {
        // roll-back the old held value
        uint256 oldHeldValue = _cache.heldWei.value.mul(_cache.heldPrice);
        if (_cache.heldWei.sign) {
            _cache.supplyValue = _cache.supplyValue.sub(oldHeldValue, "cache.heldWei.sign");
        } else {
            _cache.borrowValue = _cache.borrowValue.sub(oldHeldValue, "!cache.heldWei.sign");
        }

        // add the new held value
        uint256 newHeldValue = _newHeldWei.value.mul(_cache.heldPrice);
        if (_newHeldWei.sign) {
            _cache.supplyValue = _cache.supplyValue.add(newHeldValue);
        } else {
            _cache.borrowValue = _cache.borrowValue.add(newHeldValue);
        }

        // roll-back the old owed value
        uint256 oldOwedValue = _cache.owedWei.value.mul(_cache.owedPrice);
        if (_cache.owedWei.sign) {
            _cache.supplyValue = _cache.supplyValue.sub(oldOwedValue, "cache.owedWei.sign");
        } else {
            _cache.borrowValue = _cache.borrowValue.sub(oldOwedValue, "!cache.owedWei.sign");
        }

        // add the new owed value
        uint256 newOwedValue = _newOwedWei.value.mul(_cache.owedPrice);
        if (_newOwedWei.sign) {
            _cache.supplyValue = _cache.supplyValue.add(newOwedValue);
        } else {
            _cache.borrowValue = _cache.borrowValue.add(newOwedValue);
        }

        // update toLiquidate, heldWei, and owedWei
        Types.Wei memory delta = _cache.owedWei.sub(_newOwedWei);
        assert(!delta.isNegative());
        _cache.toLiquidate = _cache.toLiquidate.add(delta.value);
        _cache.heldWei = _newHeldWei;
        _cache.owedWei = _newOwedWei;
    }

    /**
     * Pre-populates cache values for some pair of markets.
     */
    function _initializeCache(
        LiquidatorProxyV1Constants memory _constants,
        uint256 _heldMarket,
        uint256 _owedMarket
    )
        private
        view
        returns (LiquidatorProxyV1Cache memory)
    {
        (
            Monetary.Value memory supplyValue,
            Monetary.Value memory borrowValue
        ) = _getAccountValues(
            _constants.dolomiteMargin,
            _constants.markets,
            _constants.solidAccount,
            _constants.dolomiteMargin.getAccountMarketsWithBalances(_constants.solidAccount),
            _constants.dolomiteMargin.getMarginRatioOverrideByAccount(_constants.solidAccount)
        );

        MarketInfo memory heldMarketInfo = _binarySearch(_constants.markets, _heldMarket);
        MarketInfo memory owedMarketInfo = _binarySearch(_constants.markets, _owedMarket);

        uint256 heldPrice = heldMarketInfo.price.value;
        uint256 owedPrice = owedMarketInfo.price.value;
        Decimal.D256 memory spread = _constants.dolomiteMargin.getLiquidationSpreadForAccountAndPair(
            _constants.liquidAccount,
            _heldMarket,
            _owedMarket
        );

        return LiquidatorProxyV1Cache({
            heldWei: Interest.parToWei(
                _constants.dolomiteMargin.getAccountPar(_constants.solidAccount, _heldMarket),
                heldMarketInfo.index
            ),
            owedWei: Interest.parToWei(
                _constants.dolomiteMargin.getAccountPar(_constants.solidAccount, _owedMarket),
                owedMarketInfo.index
            ),
            toLiquidate: 0,
            supplyValue: supplyValue.value,
            borrowValue: borrowValue.value,
            heldMarket: _heldMarket,
            owedMarket: _owedMarket,
            spread: spread,
            heldPrice: heldPrice,
            owedPrice: owedPrice,
            owedPriceAdj: owedPrice.add(Decimal.mul(owedPrice, spread))
        });
    }

    function _constructAccountsArray(
        LiquidatorProxyV1Constants memory _constants
    )
        private
        pure
        returns (Account.Info[] memory)
    {
        Account.Info[] memory accounts = new Account.Info[](2);
        accounts[0] = _constants.solidAccount;
        accounts[1] = _constants.liquidAccount;
        return accounts;
    }

    function _constructActionsArray(
        LiquidatorProxyV1Cache memory _cache
    )
        private
        pure
        returns (Actions.ActionArgs[] memory)
    {
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Liquidate,
            accountId: 0,
            amount: Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: _cache.toLiquidate
            }),
            primaryMarketId: _cache.owedMarket,
            secondaryMarketId: _cache.heldMarket,
            otherAddress: address(0),
            otherAccountId: 1,
            data: new bytes(0)
        });
        return actions;
    }
}
