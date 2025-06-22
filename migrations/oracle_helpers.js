const {
  isDevNetwork,
  isArbitrumOne,
  isArbitrumNetwork,
  isBaseNetwork,
  isPolygonZkEvmNetwork,
  isPolygonZkEvm,
  isMantleNetwork,
  isXLayerNetwork,
  isBase,
  isBeraNetwork,
  isEthereumNetwork,
  isInk,
  isSuperSeed,
  getContract,
  isBotanixNetwork,
} = require('./helpers');
const {
  getDaiAddress,
  getLinkAddress,
  getLrcAddress,
  getUsdcAddress,
  getWbtcAddress,
  getWethAddress,
  getUsdtAddress,
} = require('./token_helpers');
const { ADDRESSES } = require('../dist/src/lib/Constants');

function getBtcUsdAggregatorAddress(network, TestBtcUsdChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestBtcUsdChainlinkAggregator.address;
  }
  if (isArbitrumOne(network)) {
    return '0x6ce185860a4963106506c203335a2910413708e9';
  }
  throw new Error(`Cannot find BTC-USD aggregator for network: ${network}`);
}

function getDaiUsdAggregatorAddress(network, TestDaiUsdChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestDaiUsdChainlinkAggregator.address;
  }
  if (isArbitrumOne(network)) {
    return '0xc5c8e77b397e531b8ec06bfb0048328b30e9ecfb';
  }
  throw new Error(`Cannot find DAI-USD aggregator for network: ${network}`);
}

function getEthUsdAggregatorAddress(network, TestEthUsdChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestEthUsdChainlinkAggregator.address;
  }
  if (isArbitrumOne(network)) {
    return '0x639fe6ab55c921f74e7fac1ee960c0b6293ba612';
  }
  if (isBase(network)) {
    return '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70';
  }
  if (isPolygonZkEvm(network)) {
    return '0x97d9F9A00dEE0004BE8ca0A8fa374d486567eE2D';
  }
  throw new Error(`Cannot find ETH-USD aggregator for network: ${network}`);
}

function getLinkUsdAggregatorAddress(network, TestLinkUsdChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestLinkUsdChainlinkAggregator.address;
  }
  if (isArbitrumOne(network)) {
    return '0x86e53cf1b870786351da77a57575e79cb55812cb';
  }
  throw new Error(`Cannot find LINK-USD aggregator for network: ${network}`);
}

function getLrcEthAggregatorAddress(network, TestLrcEthChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestLrcEthChainlinkAggregator.address;
  }
  throw new Error(`Cannot find LRC-USD aggregator for network: ${network}`);
}

function getUsdcUsdAggregatorAddress(network) {
  if (isArbitrumOne(network)) {
    return '0x50834f3163758fcc1df9973b6e91f0f0f0434ad3';
  }
  throw new Error(`Cannot find USDC-USD aggregator for network: ${network}`);
}

function getUsdtUsdAggregatorAddress(network) {
  if (isArbitrumOne(network)) {
    return '0x3f3f5df88dc9f13eac63df89ec16ef6e7e25dde7';
  }
  throw new Error(`Cannot find USDT-USD aggregator for network: ${network}`);
}

function getUsdcEthAggregatorAddress(network, TestUsdcEthChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestUsdcEthChainlinkAggregator.address;
  }
  throw new Error(`Cannot find USDC-ETH aggregator for network: ${network}`);
}

function getChainlinkPriceOracleArtifact(network, artifacts) {
  if (isDevNetwork(network)) {
    return artifacts.require('TestChainlinkPriceOracleV1');
  } else {
    return artifacts.require('ChainlinkPriceOracleV1');
  }
}

async function getChainlinkPriceOracleContract(network, artifacts) {
  if (isDevNetwork(network)) {
    return artifacts.require('TestChainlinkPriceOracleV1');
  } else {
    return getContract(network, artifacts.require('ChainlinkPriceOracleV1'));
  }
}

function getChainlinkPriceOracleV1Params(network, tokens, aggregators) {
  if (isArbitrumNetwork(network)) {
    const pairs = [
      [getDaiAddress(network), getDaiUsdAggregatorAddress(network), 18, ADDRESSES.ZERO],
      [getLinkAddress(network), getLinkUsdAggregatorAddress(network), 18, ADDRESSES.ZERO],
      [getUsdcAddress(network), getUsdcUsdAggregatorAddress(network), 6, ADDRESSES.ZERO],
      [getWethAddress(network), getEthUsdAggregatorAddress(network), 18, ADDRESSES.ZERO],
      [getWbtcAddress(network), getBtcUsdAggregatorAddress(network), 8, ADDRESSES.ZERO],
    ];
    if (isArbitrumOne(network)) {
      pairs.push([getUsdtAddress(network), getUsdtUsdAggregatorAddress(network), 6, ADDRESSES.ZERO]);
    }
    return mapPairsToParams(pairs);
  } else if (isBaseNetwork(network) || isPolygonZkEvmNetwork(network)) {
    const pairs = [[getWethAddress(network), getEthUsdAggregatorAddress(network), 18, ADDRESSES.ZERO]];
    return mapPairsToParams(pairs);
  } else if (
    isBeraNetwork(network) ||
    isBotanixNetwork(network) ||
    isEthereumNetwork(network) ||
    isInk(network) ||
    isMantleNetwork(network) ||
    isSuperSeed(network) ||
    isXLayerNetwork(network)
  ) {
    return undefined; // return nothing since Chainlink is not live
  } else if (isDevNetwork(network)) {
    const { TokenA, TokenB, TokenD, TokenE, TokenF, TestWETH } = tokens;

    const {
      btcUsdAggregator,
      daiUsdAggregator,
      ethUsdAggregator,
      linkUsdAggregator,
      lrcEthAggregator,
      usdcUsdAggregator,
    } = aggregators;

    return mapPairsToParams([
      // eslint-disable-next-line max-len
      [getWethAddress(network, TestWETH), getEthUsdAggregatorAddress(network, ethUsdAggregator), 18, ADDRESSES.ZERO],
      // eslint-disable-next-line max-len
      [getDaiAddress(network, TokenB), getDaiUsdAggregatorAddress(network, daiUsdAggregator), 18, ADDRESSES.ZERO],
      // eslint-disable-next-line max-len
      [getLinkAddress(network, TokenE), getLinkUsdAggregatorAddress(network, linkUsdAggregator), 18, ADDRESSES.ZERO],
      // eslint-disable-next-line max-len
      [
        getLrcAddress(network, TokenF),
        getLrcEthAggregatorAddress(network, lrcEthAggregator),
        18,
        getWethAddress(network, TestWETH),
        18,
      ],
      // eslint-disable-next-line max-len
      [getUsdcAddress(network, TokenA), getUsdcEthAggregatorAddress(network, usdcUsdAggregator), 6, ADDRESSES.ZERO],
      // eslint-disable-next-line max-len
      [getWbtcAddress(network, TokenD), getBtcUsdAggregatorAddress(network, btcUsdAggregator), 8, ADDRESSES.ZERO],
    ]);
  }

  throw new Error(`Cannot find ChainlinkPriceOracleV1 params for network: ${network}`);
}

function mapPairsToParams(pairs) {
  return {
    tokens: pairs.map(pair => pair[0]),
    aggregators: pairs.map(pair => pair[1]),
    tokenDecimals: pairs.map(pair => pair[2]),
    tokenPairs: pairs.map(pair => pair[3]),
  };
}

module.exports = {
  getChainlinkPriceOracleV1Params,
  getChainlinkPriceOracleArtifact,
  getChainlinkPriceOracleContract,
};
