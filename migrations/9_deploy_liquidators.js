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
  setGlobalOperatorIfNecessary,
  getChainId,
  getContract,
  deployContractIfNecessary,
} = require('./helpers');

// ============ Contracts ============

// Base Protocol
const DolomiteMargin = artifacts.require('DolomiteMargin');

// Test Contracts
const TestDolomiteMargin = artifacts.require('TestDolomiteMargin');

// Second-Layer Contracts
const Expiry = artifacts.require('Expiry');
const ExpiryProxy = artifacts.require('ExpiryProxy');
const LiquidatorAssetRegistry = artifacts.require('LiquidatorAssetRegistry');
const LiquidatorProxyV1 = artifacts.require('LiquidatorProxyV1');
const LiquidatorProxyV4WithGenericTrader = artifacts.require('LiquidatorProxyV4WithGenericTrader');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deploySecondLayer(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deploySecondLayer(deployer, network) {
  const dolomiteMargin = await getDolomiteMargin(network);
  const expiry = await getContract(network, Expiry);
  const liquidatorAssetRegistry = await getContract(network, LiquidatorAssetRegistry);

  const expiryProxy = await deployContractIfNecessary(artifacts, deployer, network, ExpiryProxy, [
    liquidatorAssetRegistry.address,
    expiry.address,
    dolomiteMargin.address,
  ]);
  const liquidatorProxyV1 = await deployContractIfNecessary(artifacts, deployer, network, LiquidatorProxyV1, [
    getChainId(network),
    liquidatorAssetRegistry.address,
    dolomiteMargin.address,
  ]);
  await deployContractIfNecessary(
    artifacts,
    deployer,
    network,
    LiquidatorProxyV4WithGenericTrader,
    [getChainId(network), expiry.address, dolomiteMargin.address, liquidatorAssetRegistry.address],
  );

  await setGlobalOperatorIfNecessary(dolomiteMargin, expiryProxy.address);
  await setGlobalOperatorIfNecessary(dolomiteMargin, liquidatorProxyV1.address);
}

async function getDolomiteMargin(network) {
  return getContract(network, isDevNetwork(network) ? TestDolomiteMargin : DolomiteMargin);
}
