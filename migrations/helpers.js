const { readFileSync, writeFileSync } = require('fs');
const Web3 = require('web3');
const { coefficientsToString, decimalToString } = require('../dist/src/lib/Helpers');

// ============ Network Helper Functions ============

async function setGlobalOperatorIfNecessary(dolomiteMargin, contractAddress) {
  if (!(await dolomiteMargin.getIsGlobalOperator(contractAddress))) {
    await dolomiteMargin.ownerSetGlobalOperator(contractAddress, true);
  }
}

async function setAutoTraderSpecialIfNecessary(dolomiteMargin, contractAddress) {
  if (!(await dolomiteMargin.getIsAutoTraderSpecial(contractAddress))) {
    await dolomiteMargin.ownerSetAutoTraderSpecial(contractAddress, true);
  }
}

function isDevNetwork(network) {
  verifyNetwork(network);
  return network === 'dev' || network === 'docker' || isCoverageTestNetwork(network) || isLocalTestNetwork(network);
}

function isLocalTestNetwork(network) {
  verifyNetwork(network);
  return network.startsWith('test');
}

function isCoverageTestNetwork(network) {
  verifyNetwork(network);
  return network.startsWith('coverage');
}

// ================== Filtered Networks ==================

function isArbitrumNetwork(network) {
  return isArbitrumOne(network);
}

function isPolygonZkEvmNetwork(network) {
  return isPolygonZkEvm(network);
}

function isBeraNetwork(network) {
  return isBerachain(network);
}

function isEthereumNetwork(network) {
  return isEthereumMainnet(network);
}

function isMantleNetwork(network) {
  return isMantle(network);
}

function isXLayerNetwork(network) {
  return isXLayer(network);
}

function isBaseNetwork(network) {
  return isBase(network);
}

function isBnbNetwork(network) {
  return isBnb(network);
}

function isBotanixNetwork(network) {
  return isBotanix(network);
}

// ================== Production Networks ==================

function isArbitrumOne(network) {
  verifyNetwork(network);
  return network === 'arbitrum_one';
}

function isBase(network) {
  verifyNetwork(network);
  return network === 'base';
}

function isBnb(network) {
  verifyNetwork(network);
  return network === 'bnb';
}

function isBotanix(network) {
  verifyNetwork(network);
  return network === 'botanix';
}

function isEthereumMainnet(network) {
  verifyNetwork(network);
  return network === 'ethereum_mainnet';
}

function isBerachain(network) {
  verifyNetwork(network);
  return network === 'berachain';
}

function isInk(network) {
  verifyNetwork(network);
  return network === 'ink';
}

function isMantle(network) {
  verifyNetwork(network);
  return network === 'mantle';
}

function isPolygonZkEvm(network) {
  verifyNetwork(network);
  return network === 'polygon_zkevm';
}

function isSuperSeed(network) {
  verifyNetwork(network);
  return network === 'super_seed';
}

function isXLayer(network) {
  verifyNetwork(network);
  return network === 'x_layer';
}

// ================== Test Networks ==================

function isDocker(network) {
  verifyNetwork(network);
  return network === 'docker';
}

function getChainId(network) {
  if (isEthereumMainnet(network)) {
    return 1;
  }
  if (isArbitrumOne(network)) {
    return 42161;
  }
  if (isBase(network)) {
    return 8453;
  }
  if (isBerachain(network)) {
    return 80094;
  }
  if (isBnb(network)) {
    return 56;
  }
  if (isBotanix(network)) {
    return 3637;
  }
  if (isCoverageTestNetwork(network)) {
    return 1002;
  }
  if ('docker' === network) {
    return 1313;
  }
  if (isEthereumMainnet(network)) {
    return 1;
  }
  if (isInk(network)) {
    return 57073;
  }
  if (isLocalTestNetwork(network)) {
    return 1001;
  }
  if (isMantle(network)) {
    return 5000;
  }
  if (isPolygonZkEvm(network)) {
    return 1101;
  }
  if (isSuperSeed(network)) {
    return 5330;
  }
  if (isXLayer(network)) {
    return 196;
  }
  throw new Error('No chainId for network ' + network);
}

async function getRiskLimits() {
  return {
    marginRatioMax: decimalToString('2.00'), // 200%
    liquidationSpreadMax: decimalToString('0.90'), // 90%
    earningsRateMax: decimalToString('1.00'), // 100%
    marginPremiumMax: decimalToString('2.00'), // 200%
    liquidationSpreadPremiumMax: decimalToString('10.00'), // 1000%
    interestRateMax: decimalToString('100.00'), // 10,000%
    minBorrowedValueMax: '100000000000000000000000000000000000000', // $100
  };
}

async function getRiskParams(network) {
  verifyNetwork(network);
  let minBorrowedValue = '0.00';
  if (isDevNetwork(network)) {
    minBorrowedValue = '0.05';
  }
  return {
    marginRatio: { value: decimalToString('0.15') },
    liquidationSpread: { value: decimalToString('0.05') },
    earningsRate: { value: decimalToString('0.80') },
    minBorrowedValue: { value: decimalToString(minBorrowedValue) },
    accountMaxNumberOfMarketsWithBalances: '32',
    callbackGasLimit: 0, // 0M
  };
}

async function getPolynomialParams() {
  return {
    maxAPR: decimalToString('1.00'), // 100%
    coefficients: coefficientsToString([0, 10, 10, 0, 0, 80]),
  };
}

async function getDoubleExponentParams() {
  return {
    maxAPR: decimalToString('1.00'), // 100%
    coefficients: coefficientsToString([0, 20, 0, 0, 0, 0, 20, 60]),
  };
}

function getExpiryRampTime() {
  return '300'; // 5 minutes
}

function verifyNetwork(network) {
  if (!network) {
    throw new Error('No network provided');
  }
}

function getDelayedMultisigAddress(network) {
  if (
    isArbitrumNetwork(network) ||
    isBaseNetwork(network) ||
    isBeraNetwork(network) ||
    isBnbNetwork(network) ||
    isBotanixNetwork(network) ||
    isEthereumMainnet(network) ||
    isInk(network) ||
    isMantleNetwork(network) ||
    isPolygonZkEvmNetwork(network) ||
    isSuperSeed(network) ||
    isXLayerNetwork(network)
  ) {
    return '0x52d7BcB650c591f6E8da90f797A1d0Bfd8fD05F9';
  }
  throw new Error('Cannot find DelayedMultisig for network: ' + network);
}

function getChainlinkOracleSentinelGracePeriod() {
  return 3600; // 1 hour
}

function getChainlinkSequencerUptimeFeed(network, TestSequencerUptimeFeedAggregator) {
  if (isDevNetwork(network)) {
    return TestSequencerUptimeFeedAggregator.address;
  } else if (isArbitrumOne(network)) {
    return '0xFdB631F5EE196F0ed6FAa767959853A9F217697D';
  } else if (isBase(network)) {
    return '0xBCF85224fc0756B9Fa45aA7892530B47e10b6433';
  } else if (
    isBotanixNetwork(network) ||
    isBeraNetwork(network) ||
    isBnbNetwork(network) ||
    isEthereumNetwork(network) ||
    isInk(network) ||
    isMantle(network) ||
    isPolygonZkEvm(network) ||
    isSuperSeed(network) ||
    isXLayer(network)
  ) {
    return null;
  }

  throw new Error(`Cannot find Sequencer Uptime Feed for ${network}`);
}

const shouldOverwrite = (contract, network) => {
  const basicCondition = process.env.OVERWRITE_EXISTING_CONTRACTS === 'true' || isDevNetwork(network);
  if (basicCondition) {
    return true;
  }

  try {
    return !contract.address;
  } catch (e) {
    // The address can't be retrieved, which means there isn't one.
    return true;
  }
};

const getNoOverwriteParams = () => ({ overwrite: false });

async function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

async function deployContractIfNecessary(artifacts, deployer, network, artifact, parameters) {
  const contractName = artifact.toJSON().contractName;

  if (shouldOverwrite(artifact, network)) {
    if (!isDevNetwork(network)) {
      const json = JSON.parse(readFileSync('migrations/deployed.json').toString());
      if (
        json[contractName] &&
        json[contractName][getChainId(network)] &&
        json[contractName][getChainId(network)].address &&
        json[contractName][getChainId(network)].address !== '0x0000000000000000000000000000000000000000'
      ) {
        return await artifact.at(json[contractName][getChainId(network)].address);
      }

      const web3 = new Web3(deployer.provider);
      let bytecode = artifact.bytecode;
      Object.keys(artifact.links).forEach(key => {
        bytecode = bytecode.split(`__${key}${'_'.repeat(38 - key.length)}`).join(artifact.links[key].substring(2));
      });
      const code = new web3.eth.Contract(artifact.toJSON().abi)
        .deploy({
          data: bytecode,
          arguments: parameters ? parameters : [],
        })
        .encodeABI();
      const salt = Web3.utils.keccak256(web3.eth.abi.encodeParameters(['string'], [contractName]));

      const CREATE3Factory = await artifacts
        .require('ICREATE3Factory')
        .at('0xa8F7e7A361De6A2172fcb2accE68bd21597599F7');

      let transactionHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const deployerAddress = web3.eth.accounts.privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
      const contractAddress = await CREATE3Factory.getDeployed(deployerAddress.address, salt);
      if ((await web3.eth.getCode(contractAddress)) === '0x') {
        const result = await CREATE3Factory.deploy(salt, code);
        await sleep(2000);
        if (!json[contractName]) {
          json[contractName] = {};
        }
        transactionHash = result.receipt.transactionHash;
      }

      if (!json[contractName][getChainId(network)] || !json[contractName][getChainId(network)].address) {
        const data = {
          links: artifact.links,
          address: contractAddress,
          transactionHash: transactionHash,
        };
        console.log('='.repeat(49 - contractName.length / 2), contractName, '='.repeat(49 - contractName.length / 2));
        console.log(JSON.stringify(data, null, 2));
        console.log('='.repeat(100));
        json[contractName][getChainId(network)] = data;
        writeFileSync('migrations/deployed.json', JSON.stringify(sortFileAndReturn(json), null, 2));
      }

      return await artifact.at(contractAddress);
    } else {
      await deployer.deploy(artifact, ...(parameters ? parameters : []));
      return await artifact.deployed();
    }
  } else {
    const json = JSON.parse(readFileSync('migrations/deployed.json').toString());
    return artifact.at(json[contractName][getChainId(network)].address);
  }
}

function sortFileAndReturn(file) {
  const sortedFileKeys = Object.keys(file).sort((a, b) => {
    const aSplitPoint = a.search(/V\d+$/);
    const bSplitPoint = b.search(/V\d+$/);
    if (aSplitPoint !== -1 && bSplitPoint !== -1) {
      const aBase = a.substring(0, aSplitPoint);
      const bBase = b.substring(0, bSplitPoint);
      if (aBase === bBase) {
        const aVersion = a.substring(aSplitPoint + 1);
        const bVersion = b.substring(bSplitPoint + 1);
        return parseInt(aVersion, 10) - parseInt(bVersion, 10);
      }
    }
    return a.localeCompare(b);
  });
  const sortedFile = {};
  for (const key of sortedFileKeys) {
    sortedFile[key] = file[key];
  }
  return sortedFile;
}

async function getContract(network, artifact) {
  if (isDevNetwork(network)) {
    return artifact.at(artifact.address);
  } else {
    const contractName = artifact.toJSON().contractName;
    const json = JSON.parse(readFileSync('migrations/deployed.json').toString());
    return await artifact.at(json[contractName][getChainId(network)].address);
  }
}

module.exports = {
  isArbitrumNetwork,
  isArbitrumOne,
  isBase,
  isBaseNetwork,
  isBotanixNetwork,
  isPolygonZkEvmNetwork,
  getChainId,
  isDevNetwork,
  isEthereumNetwork,
  isBeraNetwork,
  isBnbNetwork,
  isInk,
  isMantleNetwork,
  isPolygonZkEvm,
  isSuperSeed,
  isXLayerNetwork,
  isDocker,
  getRiskLimits,
  getRiskParams,
  getPolynomialParams,
  getDoubleExponentParams,
  getExpiryRampTime,
  getDelayedMultisigAddress,
  getChainlinkSequencerUptimeFeed,
  getChainlinkOracleSentinelGracePeriod,
  shouldOverwrite,
  getNoOverwriteParams,
  setGlobalOperatorIfNecessary,
  setAutoTraderSpecialIfNecessary,
  deployContractIfNecessary,
  getContract,
};
