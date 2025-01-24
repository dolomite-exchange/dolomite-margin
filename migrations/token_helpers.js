const {
  isDevNetwork,
  isEthereumMainnet,
  isArbitrumOne,
  isPolygonZkEvm,
  isBaseNetwork,
  isMantleNetwork,
  isXLayerNetwork,
  isBerachain,
  isBeraCartio,
} = require('./helpers');

function getDaiAddress(network, TokenB) {
  if (isDevNetwork(network)) {
    return TokenB.address;
  }
  if (isArbitrumOne(network)) {
    return '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1';
  }
  if (isEthereumMainnet(network)) {
    return '0x6b175474e89094c44da98b954eedeac495271d0f';
  }
  throw new Error('Cannot find DAI');
}

function getLinkAddress(network, TokenE) {
  if (isDevNetwork(network)) {
    return TokenE.address;
  }
  if (isEthereumMainnet(network)) {
    return '0x514910771af9ca656af840dff83e8264ecf986ca';
  }
  if (isArbitrumOne(network)) {
    return '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4';
  }
  throw new Error('Cannot find LINK');
}

function getLrcAddress(network, TokenF) {
  if (isDevNetwork(network)) {
    return TokenF.address;
  }
  if (isEthereumMainnet(network)) {
    return '0xbbbbca6a901c926f240b89eacb641d8aec7aeafd';
  }
  if (isArbitrumOne(network)) {
    return '0x46d0cE7de6247b0A95f67b43B589b4041BaE7fbE';
  }
  throw new Error('Cannot find LRC');
}

function getUsdcAddress(network, TokenA) {
  if (isDevNetwork(network)) {
    return TokenA.address;
  }
  if (isArbitrumOne(network)) {
    return '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';
  }
  if (isEthereumMainnet(network)) {
    return '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  }
  throw new Error('Cannot find USDC');
}

function getUsdtAddress(network) {
  if (isArbitrumOne(network)) {
    return '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
  }
  throw new Error('Cannot find USDT');
}

function getWbtcAddress(network, TokenD) {
  if (isDevNetwork(network)) {
    return TokenD.address;
  }
  if (isArbitrumOne(network)) {
    return '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';
  }
  if (isEthereumMainnet(network)) {
    return '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
  }
  throw new Error('Cannot find WBTC');
}

function getWethAddress(network, WETH) {
  if (isDevNetwork(network)) {
    return WETH.address;
  }
  if (isArbitrumOne(network)) {
    return '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
  }
  if (isBaseNetwork(network)) {
    return '0x4200000000000000000000000000000000000006';
  }
  if (isEthereumMainnet(network)) {
    return '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  }
  if (isPolygonZkEvm(network)) {
    return '0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9';
  }
  throw new Error('Cannot find WETH');
}

function getWrappedCurrencyAddress(network, WETH) {
  // If a network we deploy to uses a different base currency...
  if (isBerachain(network)) {
    return '0x6969696969696969696969696969696969696969'; // wBERA
  } else if (isBeraCartio(network)) {
    return '0x7507c1dc16935B82698e4C63f2746A2fCf994dF8'; // wBERA
  } else if (isMantleNetwork(network)) {
    return '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8'; // wMNT
  } else if (isXLayerNetwork(network)) {
    return '0xe538905cf8410324e03a5a23c1c177a474d59b2b'; // wOKB
  }

  // fall through case
  return getWethAddress(network, WETH);
}

module.exports = {
  getDaiAddress,
  getLinkAddress,
  getLrcAddress,
  getUsdcAddress,
  getUsdtAddress,
  getWbtcAddress,
  getWethAddress,
  getWrappedCurrencyAddress,
};
