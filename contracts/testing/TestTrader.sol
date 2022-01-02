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

import { SafeERC20 } from "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import { OnlySolo } from "../external/helpers/OnlySolo.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IExchangeWrapper } from "../protocol/interfaces/IExchangeWrapper.sol";
import { IRecyclable } from "../protocol/interfaces/IRecyclable.sol";
import { CustomTestToken } from "./CustomTestToken.sol";

contract TestTrader is IExchangeWrapper, OnlySolo {
    using SafeERC20 for IERC20;


    constructor(
        address soloMargin
    ) public OnlySolo(soloMargin) {
    }

    function exchange(
        address,
        address,
        address makerToken,
        address takerToken,
        uint256 requestedFillAmount,
        bytes calldata orderData
    )
    external
    onlySolo(msg.sender)
    returns (uint256) {
        // makerToken is the token being traded to (supply token after the tx is over). This contract receives
        // takerToken in exchange for makerToken
        (uint makerAmount, uint takerAmount) = abi.decode(orderData, (uint, uint));
        require(
            takerAmount == requestedFillAmount,
            "TestTrader: invalid taker amounts"
        );
        IERC20 underlyingToken = IRecyclable(makerToken).TOKEN();
        if (underlyingToken.allowance(address(this), makerToken) < makerAmount) {
            underlyingToken.approve(makerToken, uint(- 1));
        }
        CustomTestToken(address(underlyingToken)).setBalance(address(this), makerAmount);
        return makerAmount;
    }

    function getExchangeCost(
        address,
        address,
        uint256 desiredMakerToken,
        bytes calldata orderData
    )
    external
    view
    returns (uint256) {
        (uint makerAmount, uint takerAmount) = abi.decode(orderData, (uint, uint));
        require(
            desiredMakerToken == makerAmount,
            "TestTrader: invalid maker amounts"
        );
        return takerAmount;
    }

}
