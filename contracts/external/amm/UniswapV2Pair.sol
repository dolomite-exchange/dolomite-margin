pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../../protocol/interfaces/IAutoTrader.sol";
import "../../protocol/interfaces/ISoloMargin.sol";

import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IUniswapV2Pair.sol";

import "../lib/AdvancedMath.sol";
import "../lib/UQ112x112.sol";

import "./UniswapV2ERC20.sol";

contract UniswapV2Pair is IUniswapV2Pair, UniswapV2ERC20, IAutoTrader {
    using SafeMath  for uint;
    using UQ112x112 for uint224;

    bytes32 private constant FILE = "UniswapV2Pair";

    uint public constant WEI_BASE = 1e18;
    uint public constant MINIMUM_LIQUIDITY = 10 ** 3;

    address public factory;
    address public token0;
    address public token1;

    uint112 private reserve0Par;            // uses single storage slot, accessible via getReserves
    uint112 private reserve1Par;            // uses single storage slot, accessible via getReserves
    uint32  private blockTimestampLast;     // uses single storage slot, accessible via getReserves

    uint128 private marketId0;
    uint128 private marketId1;

    uint public price0CumulativeLast;
    uint public price1CumulativeLast;
    uint public kLast; // reserve0 * reserve1, as of immediately after the most recent liquidity event

    uint private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, "UniswapV2: LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    struct Cache {
        ISoloMargin soloMargin;
        uint marketId0;
        uint marketId1;
        uint balance0;
        uint balance1;
        Interest.Index inputIndex;
        Interest.Index outputIndex;
    }

    constructor() public {
        factory = msg.sender;
    }

    // called once by the factory at time of deployment
    function initialize(address _token0, address _token1) external {
        require(msg.sender == factory, "UniswapV2: FORBIDDEN");
        // sufficient check
        token0 = _token0;
        token1 = _token1;

        marketId0 = uint128(ISoloMargin(soloMargin()).getMarketIdByTokenAddress(token0));
        marketId1 = uint128(ISoloMargin(soloMargin()).getMarketIdByTokenAddress(token1));
    }

    function soloMargin() public view returns (address) {
        return IUniswapV2Factory(factory).soloMargin();
    }

    function getReservesPar() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        _reserve0 = reserve0Par;
        _reserve1 = reserve1Par;
        _blockTimestampLast = blockTimestampLast;
    }

    function getReservesWei() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        ISoloMargin _soloMargin = ISoloMargin(soloMargin());
        uint _marketId0 = marketId0;
        uint _marketId1 = marketId1;

        uint reserve0InterestIndex = _soloMargin.getMarketCurrentIndex(_marketId0).supply;
        uint reserve1InterestIndex = _soloMargin.getMarketCurrentIndex(_marketId1).supply;

        _reserve0 = uint112(uint(reserve0Par).mul(reserve0InterestIndex).div(WEI_BASE));
        _reserve1 = uint112(uint(reserve1Par).mul(reserve1InterestIndex).div(WEI_BASE));
        _blockTimestampLast = blockTimestampLast;
    }

    // this low-level function should be called from a contract which performs important safety checks
    function mint(address to) external lock returns (uint liquidity) {
        (uint112 _reserve0, uint112 _reserve1,) = getReservesPar();
        // gas savings
        ISoloMargin _soloMargin = ISoloMargin(soloMargin());
        uint balance0 = _getTokenBalancePar(_soloMargin, marketId0);
        uint balance1 = _getTokenBalancePar(_soloMargin, marketId1);
        uint amount0 = balance0.sub(_reserve0);
        uint amount1 = balance1.sub(_reserve1);

        require(
            amount0 > 0,
            "UniswapV2: INVALID_MINT_AMOUNT_0"
        );
        require(
            amount1 > 0,
            "UniswapV2: INVALID_MINT_AMOUNT_1"
        );

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint _totalSupply = totalSupply;
        // gas savings, must be defined here since totalSupply can update in _mintFee
        if (_totalSupply == 0) {
            liquidity = AdvancedMath.sqrt(amount0.mul(amount1)).sub(MINIMUM_LIQUIDITY);
            // permanently lock the first MINIMUM_LIQUIDITY tokens
            _mint(address(0), MINIMUM_LIQUIDITY);
        } else {
            liquidity = Math.min(amount0.mul(_totalSupply) / _reserve0, amount1.mul(_totalSupply) / _reserve1);
        }

        require(
            liquidity > 0,
            "UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED"
        );

        _mint(to, liquidity);

        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint(reserve0Par).mul(reserve1Par);
        // reserve0 and reserve1 are up-to-date
        emit Mint(msg.sender, amount0, amount1);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function burn(address to, uint toAccountNumber) external lock returns (uint amount0, uint amount1) {
        (uint112 _reserve0, uint112 _reserve1,) = getReservesPar();
        // gas savings
        ISoloMargin _soloMargin = ISoloMargin(soloMargin());
        // gas savings
        uint _marketId0 = marketId0;
        // gas savings
        uint _marketId1 = marketId1;
        // gas savings
        uint balance0 = _getTokenBalancePar(_soloMargin, _marketId0);
        uint balance1 = _getTokenBalancePar(_soloMargin, _marketId1);

        bool feeOn;
        // new scope to prevent stack-too-deep issues
        {
            uint liquidity = balanceOf[address(this)];

            feeOn = _mintFee(_reserve0, _reserve1);
            uint _totalSupply = totalSupply;
            // gas savings, must be defined here since totalSupply can update in _mintFee
            amount0 = liquidity.mul(balance0) / _totalSupply;
            // using balances ensures pro-rata distribution
            amount1 = liquidity.mul(balance1) / _totalSupply;
            // using balances ensures pro-rata distribution
            require(
                amount0 > 0 && amount1 > 0,
                "UniswapV2: INSUFFICIENT_LIQUIDITY_BURNED"
            );

            _burn(address(this), liquidity);
        }

        {
            Account.Info[] memory accounts = new Account.Info[](2);
            accounts[0] = Account.Info(address(this), 0);
            accounts[1] = Account.Info(to, toAccountNumber);

            Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](2);
            actions[0] = _encodeTransferAction(0, 1, _marketId0, amount0);
            actions[1] = _encodeTransferAction(0, 1, _marketId1, amount1);

            IUniswapV2Factory(factory).operate(accounts, actions);
        }

        balance0 = _getTokenBalancePar(_soloMargin, _marketId0);
        balance1 = _getTokenBalancePar(_soloMargin, _marketId1);

        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint(reserve0Par).mul(reserve1Par);

        // reserve0 and reserve1 are up-to-date
        emit Burn(msg.sender, amount0, amount1, to);
    }

    function _encodeTransferAction(
        uint fromAccountIndex,
        uint toAccountIndex,
        uint marketId,
        uint amount
    ) internal pure returns (Actions.ActionArgs memory) {
        return Actions.ActionArgs({
        actionType : Actions.ActionType.Transfer,
        accountId : fromAccountIndex,
        amount : Types.AssetAmount(false, Types.AssetDenomination.Par, Types.AssetReference.Delta, amount),
        primaryMarketId : marketId,
        secondaryMarketId : uint(- 1),
        otherAddress : address(0),
        otherAccountId : toAccountIndex,
        data : bytes("")
        });
    }

    function getTradeCost(
        uint256 inputMarketId,
        uint256 outputMarketId,
        Account.Info memory makerAccount,
        Account.Info memory takerAccount,
        Types.Par memory,
        Types.Par memory,
        Types.Wei memory inputWei,
        bytes memory data
    )
    public
    returns (Types.AssetAmount memory) {
        Cache memory cache;
        {
            ISoloMargin _soloMargin = ISoloMargin(soloMargin());
            cache = Cache({
            soloMargin : _soloMargin,
            marketId0 : marketId0,
            marketId1 : marketId1,
            balance0 : _getTokenBalancePar(_soloMargin, marketId0),
            balance1 : _getTokenBalancePar(_soloMargin, marketId1),
            inputIndex : _soloMargin.getMarketCurrentIndex(inputMarketId),
            outputIndex : _soloMargin.getMarketCurrentIndex(outputMarketId)
            });
        }

        require(
            msg.sender == address(cache.soloMargin),
            "UniswapV2: INVALID_SENDER"
        );
        require(
            makerAccount.owner == address(this),
            "UniswapV2: INVALID_MAKER_ACCOUNT_OWNER"
        );
        require(
            makerAccount.number == 0,
            "UniswapV2: INVALID_MAKER_ACCOUNT_NUMBER"
        );

        require(
            token0 != takerAccount.owner && token1 != takerAccount.owner,
            "UniswapV2: INVALID_TO"
        );

        uint amount0Out;
        uint amount1Out;
        {
            require(
                inputMarketId == cache.marketId0 || inputMarketId == cache.marketId1,
                "UniswapV2: INVALID_INPUT_TOKEN"
            );
            require(
                outputMarketId == cache.marketId0 || outputMarketId == cache.marketId1,
                "UniswapV2: INVALID_INPUT_TOKEN"
            );

            (uint amountOutWei) = abi.decode(data, ((uint)));
            uint amountOutPar = Interest.weiToPar(Types.Wei(true, amountOutWei), cache.outputIndex).value;

            require(
                amountOutPar > 0,
                "UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT"
            );

            if (inputMarketId == cache.marketId0) {
                cache.balance0 = cache.balance0.add(Interest.weiToPar(inputWei, cache.inputIndex).value);
                cache.balance1 = cache.balance1.sub(amountOutPar);

                amount0Out = 0;
                amount1Out = amountOutPar;
            } else {
                assert(inputMarketId == cache.marketId1);

                cache.balance1 = cache.balance1.add(Interest.weiToPar(inputWei, cache.inputIndex).value);
                cache.balance0 = cache.balance0.sub(amountOutPar);

                amount0Out = amountOutPar;
                amount1Out = 0;
            }
        }

        uint amount0In;
        uint amount1In;
        {
            // gas savings
            (uint112 _reserve0, uint112 _reserve1,) = getReservesPar();
            require(
                amount0Out < _reserve0 && amount1Out < _reserve1,
                "UniswapV2: INSUFFICIENT_LIQUIDITY"
            );

            amount0In = cache.balance0 > _reserve0 - amount0Out ? cache.balance0 - (_reserve0 - amount0Out) : 0;
            amount1In = cache.balance1 > _reserve1 - amount1Out ? cache.balance1 - (_reserve1 - amount1Out) : 0;
            require(
                amount0In > 0 || amount1In > 0,
                "UniswapV2: INSUFFICIENT_INPUT_AMOUNT"
            );

            uint balance0Adjusted = cache.balance0.mul(1000).sub(amount0In.mul(3));
            uint balance1Adjusted = cache.balance1.mul(1000).sub(amount1In.mul(3));
            require(
                balance0Adjusted.mul(balance1Adjusted) >= uint(_reserve0).mul(_reserve1).mul(1000 ** 2),
                "UniswapV2: K"
            );

            _update(cache.balance0, cache.balance1, _reserve0, _reserve1);
        }

        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, takerAccount.owner);

        return Types.AssetAmount({
        sign : false,
        denomination : Types.AssetDenomination.Wei,
        ref : Types.AssetReference.Delta,
        value : amount0Out > 0 ? amount0Out : amount1Out
        });
    }

    // force balances to match reserves
    function skim(address to) external lock {
        // gas savings
        ISoloMargin _soloMargin = ISoloMargin(soloMargin());
        uint _marketId0 = marketId0;
        uint _marketId1 = marketId1;

        Account.Info[] memory accounts = new Account.Info[](2);
        accounts[0] = Account.Info(msg.sender, 0);
        accounts[1] = Account.Info(to, 0);

        uint amount0 = _getTokenBalancePar(_soloMargin, _marketId0).sub(reserve0Par);
        uint amount1 = _getTokenBalancePar(_soloMargin, _marketId1).sub(reserve1Par);

        Actions.ActionArgs[] memory actionArgs = new Actions.ActionArgs[](2);
        actionArgs[0] = _encodeTransferAction(0, 1, _marketId0, amount0);
        actionArgs[1] = _encodeTransferAction(0, 1, _marketId1, amount1);

        _soloMargin.operate(accounts, actionArgs);
    }

    // force reserves to match balances
    function sync() external lock {
        ISoloMargin _soloMargin = ISoloMargin(soloMargin());
        _update(
            _getTokenBalancePar(_soloMargin, marketId0),
            _getTokenBalancePar(_soloMargin, marketId1),
            reserve0Par,
            reserve1Par
        );
    }

    // *************************
    // ***** Internal Functions
    // *************************

    // update reserves and, on the first call per block, price accumulators. THESE SHOULD ALL BE IN PAR
    function _update(
        uint balance0,
        uint balance1,
        uint112 _reserve0,
        uint112 _reserve1
    ) internal {
        require(
            balance0 <= uint112(- 1) && balance1 <= uint112(- 1),
            "UniswapV2: OVERFLOW"
        );

        uint32 blockTimestamp = uint32(block.timestamp % 2 ** 32);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        // overflow is desired
        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            // * never overflows, and + overflow is desired
            price0CumulativeLast += uint(UQ112x112.encode(_reserve1).uqdiv(_reserve0)) * timeElapsed;
            price1CumulativeLast += uint(UQ112x112.encode(_reserve0).uqdiv(_reserve1)) * timeElapsed;
        }
        reserve0Par = uint112(balance0);
        reserve1Par = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0Par, reserve1Par);
    }

    // if fee is on, mint liquidity equivalent to 1/6th of the growth in sqrt(k)
    function _mintFee(
        uint112 _reserve0,
        uint112 _reserve1
    ) private returns (bool feeOn) {
        address feeTo = IUniswapV2Factory(factory).feeTo();
        // gas savings
        feeOn = feeTo != address(0);
        uint _kLast = kLast;
        // gas savings
        if (feeOn) {
            if (_kLast != 0) {
                uint rootK = AdvancedMath.sqrt(uint(_reserve0).mul(_reserve1));
                uint rootKLast = AdvancedMath.sqrt(_kLast);
                if (rootK > rootKLast) {
                    uint numerator = totalSupply.mul(rootK.sub(rootKLast));
                    uint denominator = rootK.mul(5).add(rootKLast);
                    uint liquidity = numerator / denominator;
                    if (liquidity > 0) _mint(feeTo, liquidity);
                }
            }
        } else if (_kLast != 0) {
            kLast = 0;
        }
    }

    function _getTokenBalancePar(
        ISoloMargin _soloMargin,
        uint marketId
    ) internal view returns (uint) {
        return _soloMargin.getAccountPar(Account.Info(address(this), 0), marketId).value;
    }

}