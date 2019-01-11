/*

    Copyright 2018 dYdX Trading Inc.

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

pragma solidity ^0.5.0;

import { Types } from "./Types.sol";


/**
 * @title Actions
 * @author dYdX
 *
 * TODO
 */
library Actions {
    
    // ============ Enums ============

    enum TransactionType {
        Deposit,   // supply tokens
        Withdraw,  // borrow tokens
        Transfer,  // transfer balance between accounts
        Buy,       // buy an amount of some token (externally)
        Sell,      // sell an amount of some token (externally)
        Trade,     // buy an amount of some token (internally)
        Liquidate, // liquidate an undercollateralized or expiring account
        Call       // send arbitrary data to an address
    }

    enum AssetDenomination {
        Wei, // the amount is denominated in token amount
        Par  // the amount is denominated in principal
    }

    enum AssetReference {
        Delta, // the amount is given as a delta from the current value
        Target // the amount is given as an exact number to end up at
    }

    // ============ Structs ============

    struct AssetAmount {
        bool sign;
        AssetDenomination denomination;
        AssetReference ref;
        uint256 value;
    }

    struct TransactionArgs {
        TransactionType transactionType;
        uint256 accountId;
        AssetAmount amount;
        uint256 primaryMarketId;
        uint256 secondaryMarketId;
        address otherAddress;
        uint256 otherAccountId;
        bytes data;
    }

    // ============ Action Types ============

    struct DepositArgs {
        uint256 accountId;
        AssetAmount amount;
        uint256 marketId;
        address from;
    }

    struct WithdrawArgs {
        uint256 accountId;
        AssetAmount amount;
        uint256 marketId;
        address to;
    }

    struct TransferArgs {
        uint256 accountId;
        AssetAmount amount;
        uint256 marketId;
        uint256 otherAccountId;
    }

    struct BuyArgs {
        uint256 accountId;
        AssetAmount amount;
        uint256 makerMarketId;
        uint256 takerMarketId;
        address exchangeWrapper;
        bytes orderData;
    }

    struct SellArgs {
        uint256 accountId;
        AssetAmount amount;
        uint256 takerMarketId;
        uint256 makerMarketId;
        address exchangeWrapper;
        bytes orderData;
    }

    struct TradeArgs {
        uint256 accountId;
        uint256 makerAccountId;
        uint256 inputMarketId;
        uint256 outputMarketId;
        AssetAmount amount;
        address tradeContract;
        bytes tradeData;
    }

    struct LiquidateArgs {
        uint256 liquidAccountId;
        AssetAmount amount;
        uint256 underwaterMarketId;
        uint256 collateralMarketId;
        uint256 stableAccountId;
    }

    struct CallArgs {
        uint256 accountId;
        address who;
        bytes data;
    }

    // ============ Parsing Functions ============

    function parseDepositArgs(
        TransactionArgs memory args
    )
        internal
        pure
        returns (DepositArgs memory)
    {
        assert(args.transactionType == TransactionType.Deposit);
        return DepositArgs({
            accountId: args.accountId,
            amount: args.amount,
            marketId: args.primaryMarketId,
            from: args.otherAddress
        });
    }

    function parseWithdrawArgs(
        TransactionArgs memory args
    )
        internal
        pure
        returns (WithdrawArgs memory)
    {
        assert(args.transactionType == TransactionType.Withdraw);
        return WithdrawArgs({
            accountId: args.accountId,
            amount: args.amount,
            marketId: args.primaryMarketId,
            to: args.otherAddress
        });
    }

    function parseTransferArgs(
        TransactionArgs memory args
    )
        internal
        pure
        returns (TransferArgs memory)
    {
        assert(args.transactionType == TransactionType.Transfer);
        require(
            args.accountId != args.otherAccountId,
            "TODO_REASON"
        );
        return TransferArgs({
            accountId: args.accountId,
            amount: args.amount,
            marketId: args.primaryMarketId,
            otherAccountId: args.otherAccountId
        });
    }

    function parseBuyArgs(
        TransactionArgs memory args
    )
        internal
        pure
        returns (BuyArgs memory)
    {
        assert(args.transactionType == TransactionType.Buy);
        return BuyArgs({
            accountId: args.accountId,
            amount: args.amount,
            makerMarketId: args.primaryMarketId,
            takerMarketId: args.secondaryMarketId,
            exchangeWrapper: args.otherAddress,
            orderData: args.data
        });
    }

    function parseSellArgs(
        TransactionArgs memory args
    )
        internal
        pure
        returns (SellArgs memory)
    {
        assert(args.transactionType == TransactionType.Sell);
        return SellArgs({
            accountId: args.accountId,
            amount: args.amount,
            takerMarketId: args.primaryMarketId,
            makerMarketId: args.secondaryMarketId,
            exchangeWrapper: args.otherAddress,
            orderData: args.data
        });
    }

    function parseTradeArgs(
        TransactionArgs memory args
    )
        internal
        pure
        returns (TradeArgs memory)
    {
        assert(args.transactionType == TransactionType.Trade);
        require(
            args.accountId != args.otherAccountId,
            "TODO_REASON"
        );
        return TradeArgs({
            accountId: args.accountId,
            makerAccountId: args.otherAccountId,
            tradeContract: args.otherAddress,
            inputMarketId: args.primaryMarketId,
            outputMarketId: args.secondaryMarketId,
            amount: args.amount,
            tradeData: args.data
        });
    }

    function parseLiquidateArgs(
        TransactionArgs memory args
    )
        internal
        pure
        returns (LiquidateArgs memory)
    {
        assert(args.transactionType == TransactionType.Liquidate);
        require(
            args.primaryMarketId != args.secondaryMarketId,
            "TODO_REASON"
        );
        require(
            args.accountId != args.otherAccountId,
            "TODO_REASON"
        );
        return LiquidateArgs({
            liquidAccountId: args.accountId,
            amount: args.amount,
            underwaterMarketId: args.primaryMarketId,
            collateralMarketId: args.secondaryMarketId,
            stableAccountId: args.otherAccountId
        });
    }

    function parseCallArgs(
        TransactionArgs memory args
    )
        internal
        pure
        returns (CallArgs memory)
    {
        assert(args.transactionType == TransactionType.Call);
        return CallArgs({
            accountId: args.accountId,
            who: args.otherAddress,
            data: args.data
        });
    }
}
