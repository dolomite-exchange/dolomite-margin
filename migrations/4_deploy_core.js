/*

    Copyright 2019 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License";
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

/**
 * @typedef {Object} artifacts
 */

const {
  isDevNetwork,
  isEthereumNetwork,
  getRiskLimits,
  getRiskParams,
  getChainlinkOracleSentinelGracePeriod,
  getChainlinkSequencerUptimeFeed,
  isArbitrumNetwork,
  isPolygonZkEvmNetwork,
  isBaseNetwork,
  isMantleNetwork,
  isXLayerNetwork,
  isBeraNetwork,
  getContract,
  deployContractIfNecessary,
  isInk,
  isSepolia,
  isSuperSeed,
  isBotanixNetwork,
  isBnbNetwork,
} = require('./helpers');

const DolomiteMargin = artifacts.require('DolomiteMargin');
const TestDolomiteMargin = artifacts.require('TestDolomiteMargin');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deployBaseProtocol(deployer, network);
  await deployTestContractsForDolomiteMarginDep(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployBaseProtocol(deployer, network) {
  // Base Protocol
  const AdminImpl = await getContract(network, artifacts.require('AdminImpl'));
  const GettersImpl = await getContract(network, artifacts.require('GettersImpl'));
  const AlwaysOnlineOracleSentinel = await getContract(network, artifacts.require('AlwaysOnlineOracleSentinel'));

  let operationImplName;
  if (!isDevNetwork(network)) {
    operationImplName = 'OperationImpl';
  } else {
    operationImplName = 'TestOperationImpl';
  }
  const OperationImpl = await getContract(network, artifacts.require(operationImplName));

  let dolomiteMargin;
  if (isDevNetwork(network)) {
    dolomiteMargin = artifacts.require('TestDolomiteMargin');
    await dolomiteMargin.link('TestOperationImpl', OperationImpl.address);
  } else if (
    isArbitrumNetwork(network) ||
    isBaseNetwork(network) ||
    isBeraNetwork(network) ||
    isBnbNetwork(network) ||
    isBotanixNetwork(network) ||
    isEthereumNetwork(network) ||
    isInk(network) ||
    isMantleNetwork(network) ||
    isPolygonZkEvmNetwork(network) ||
    isSepolia(network) ||
    isSuperSeed(network) ||
    isXLayerNetwork(network)
  ) {
    dolomiteMargin = DolomiteMargin;
  } else {
    throw new Error('Cannot deploy DolomiteMargin');
  }

  await Promise.all([
    dolomiteMargin.link('AdminImpl', AdminImpl.address),
    dolomiteMargin.link('GettersImpl', GettersImpl.address),
    dolomiteMargin.link('OperationImpl', OperationImpl.address),
  ]);

  const riskParams = await getRiskParams(network);
  dolomiteMargin = await deployContractIfNecessary(artifacts, deployer, network, dolomiteMargin, [
    await getRiskLimits(),
    riskParams.marginRatio,
    riskParams.liquidationSpread,
    riskParams.earningsRate,
    riskParams.minBorrowedValue,
    riskParams.accountMaxNumberOfMarketsWithBalances,
    AlwaysOnlineOracleSentinel.address,
    riskParams.callbackGasLimit,
  ]);

  const TestSequencerUptimeFeedAggregator = artifacts.require('TestSequencerUptimeFeedAggregator');
  const ChainlinkOracleSentinel = artifacts.require('ChainlinkOracleSentinel');
  let uptimeFeed = getChainlinkSequencerUptimeFeed(network, TestSequencerUptimeFeedAggregator);
  if (uptimeFeed) {
    const chainlinkOracleSentinel = await deployContractIfNecessary(
      artifacts,
      deployer,
      network,
      ChainlinkOracleSentinel,
      [getChainlinkOracleSentinelGracePeriod(), uptimeFeed, dolomiteMargin.address],
    );

    if ((await dolomiteMargin.getOracleSentinel()).toLowerCase() !== chainlinkOracleSentinel.address.toLowerCase()) {
      await dolomiteMargin.ownerSetOracleSentinel(chainlinkOracleSentinel.address);
    }
  }
}

async function deployTestContractsForDolomiteMarginDep(deployer, network) {
  if (isDevNetwork(network)) {
    const TestCallee = artifacts.require('TestCallee');
    const TestParaswapTrader = artifacts.require('TestParaswapTrader');
    const TestParaswapAugustusRouter = artifacts.require('TestParaswapAugustusRouter');
    const TestParaswapTransferProxy = artifacts.require('TestParaswapTransferProxy');
    const TestSimpleCallee = artifacts.require('TestSimpleCallee');

    await deployer.deploy(TestParaswapTransferProxy);
    await deployer.deploy(TestParaswapAugustusRouter, TestParaswapTransferProxy.address);
    await Promise.all([
      deployer.deploy(
        TestParaswapTrader,
        TestParaswapAugustusRouter.address,
        TestParaswapTransferProxy.address,
        TestDolomiteMargin.address,
      ),
      deployer.deploy(TestCallee, TestDolomiteMargin.address),
      deployer.deploy(TestSimpleCallee, TestDolomiteMargin.address),
    ]);
  }
}
