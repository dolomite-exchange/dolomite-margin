/*

    Copyright 2021 Dolomite

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

import { IAutoTrader } from "../interfaces/IAutoTrader.sol";

import { Actions } from "../lib/Actions.sol";
import { Cache } from "../lib/Cache.sol";
import { Events } from "../lib/Events.sol";
import { Exchange } from "../lib/Exchange.sol";
import { Interest } from "../lib/Interest.sol";
import { Require } from "../lib/Require.sol";
import { SafeExternalCallback } from "../lib/SafeExternalCallback.sol";
import { Storage } from "../lib/Storage.sol";
import { Types } from "../lib/Types.sol";


library TradeImpl {
    using Storage for Storage.State;
    using Types for Types.Wei;

    // ============ Constants ============

    bytes32 private constant FILE = "TradeImpl";

    // ============ Account Actions ============

    function buy(
        Storage.State storage state,
        Actions.BuyArgs memory args,
        Interest.Index memory takerIndex,
        Interest.Index memory makerIndex
    )
    public
    {
        state.requireIsOperator(args.account, msg.sender);

        address takerToken = state.getToken(args.takerMarket);
        address makerToken = state.getToken(args.makerMarket);

        (, Types.Wei memory makerWei) = state.getNewParAndDeltaWei(
            args.account,
            args.makerMarket,
            makerIndex,
            args.amount
        );

        Types.Wei memory takerWei = Exchange.getCost(
            args.exchangeWrapper,
            makerToken,
            takerToken,
            makerWei,
            args.orderData
        );

        Types.Wei memory tokensReceived = Exchange.exchange(
            args.exchangeWrapper,
            args.account.owner,
            makerToken,
            takerToken,
            takerWei,
            args.orderData
        );

        if (tokensReceived.value >= makerWei.value) { /* FOR COVERAGE TESTING */ }
        Require.that(tokensReceived.value >= makerWei.value,
            FILE,
            "Buy amount less than promised",
            tokensReceived.value
        );

        state.setParFromDeltaWei(
            args.account,
            args.makerMarket,
            makerIndex,
            tokensReceived
        );

        state.setParFromDeltaWei(
            args.account,
            args.takerMarket,
            takerIndex,
            takerWei
        );

        Events.logBuy(
            state,
            args,
            takerWei,
            makerWei
        );
    }

    function sell(
        Storage.State storage state,
        Actions.SellArgs memory args,
        Interest.Index memory takerIndex,
        Interest.Index memory makerIndex
    )
    public
    {
        state.requireIsOperator(args.account, msg.sender);

        address takerToken = state.getToken(args.takerMarket);
        address makerToken = state.getToken(args.makerMarket);

        (
            Types.Par memory takerPar,
            Types.Wei memory takerWei
        ) = state.getNewParAndDeltaWei(
            args.account,
            args.takerMarket,
            takerIndex,
            args.amount
        );

        Types.Wei memory makerWei = Exchange.exchange(
            args.exchangeWrapper,
            args.account.owner,
            makerToken,
            takerToken,
            takerWei,
            args.orderData
        );

        state.setPar(
            args.account,
            args.takerMarket,
            takerPar
        );

        state.setParFromDeltaWei(
            args.account,
            args.makerMarket,
            makerIndex,
            makerWei
        );

        Events.logSell(
            state,
            args,
            takerWei,
            makerWei
        );
    }

    function trade(
        Storage.State storage state,
        Actions.TradeArgs memory args,
        Interest.Index memory inputIndex,
        Interest.Index memory outputIndex
    )
    public
    {
        state.requireIsOperator(args.takerAccount, msg.sender);
        state.requireIsOperator(args.makerAccount, args.autoTrader);
        if (state.isAutoTraderSpecial(args.autoTrader)) {
            if (state.isGlobalOperator(msg.sender)) { /* FOR COVERAGE TESTING */ }
            Require.that(state.isGlobalOperator(msg.sender),
                FILE,
                "Unpermissioned trade operator"
            );
        }

        Types.Par memory oldInputPar = state.getPar(
            args.makerAccount,
            args.inputMarket
        );

        Types.Par memory newInputPar;
        Types.Wei memory inputWei;
        if (args.calculateAmountWithMakerAccount) {
            (newInputPar, inputWei) = state.getNewParAndDeltaWei(
                args.makerAccount,
                args.inputMarket,
                inputIndex,
                args.amount
            );
        } else {
            (,Types.Wei memory takerInputWei) = state.getNewParAndDeltaWei(
                args.takerAccount,
                args.inputMarket,
                inputIndex,
                args.amount
            );
            // invert the sign for the maker account
            Types.AssetAmount memory makerAssetAmount = Types.AssetAmount({
                sign: !takerInputWei.sign,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: takerInputWei.value
            });
            (newInputPar, inputWei) = state.getNewParAndDeltaWei(
                args.makerAccount,
                args.inputMarket,
                inputIndex,
                makerAssetAmount
            );
        }

        Types.AssetAmount memory outputAmount = IAutoTrader(args.autoTrader).getTradeCost(
            args.inputMarket,
            args.outputMarket,
            args.makerAccount,
            args.takerAccount,
            oldInputPar,
            newInputPar,
            inputWei,
            args.tradeData
        );

        (
            Types.Par memory newOutputPar,
            Types.Wei memory outputWei
        ) = state.getNewParAndDeltaWei(
            args.makerAccount,
            args.outputMarket,
            outputIndex,
            outputAmount
        );

        if (outputWei.isZero() || inputWei.isZero() || outputWei.sign != inputWei.sign) { /* FOR COVERAGE TESTING */ }
        Require.that(outputWei.isZero() || inputWei.isZero() || outputWei.sign != inputWei.sign,
            FILE,
            "Trades cannot be one-sided",
            args.autoTrader
        );

        // set the balance for the maker
        state.setPar(
            args.makerAccount,
            args.inputMarket,
            newInputPar
        );
        state.setPar(
            args.makerAccount,
            args.outputMarket,
            newOutputPar
        );

        // set the balance for the taker
        state.setParFromDeltaWei(
            args.takerAccount,
            args.inputMarket,
            inputIndex,
            inputWei.negative()
        );
        state.setParFromDeltaWei(
            args.takerAccount,
            args.outputMarket,
            outputIndex,
            outputWei.negative()
        );

        uint256 callbackGasLimit = state.riskParams.callbackGasLimit;
        SafeExternalCallback.callInternalBalanceChangeIfNecessary(
            args.makerAccount,
            args.takerAccount,
            args.inputMarket,
            inputWei,
            args.outputMarket,
            outputWei,
            callbackGasLimit
        );
        SafeExternalCallback.callInternalBalanceChangeIfNecessary(
            args.takerAccount,
            args.makerAccount,
            args.inputMarket,
            inputWei.negative(),
            args.outputMarket,
            outputWei.negative(),
            callbackGasLimit
        );

        Events.logTrade(
            state,
            args,
            inputWei,
            outputWei
        );
    }
}
