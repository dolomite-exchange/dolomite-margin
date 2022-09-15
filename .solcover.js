// const { Typechain } = require('typechain');
// const { tsGenerator } = require('ts-generator');
// const truffleUtils = require('solidity-coverage/plugins/resources/truffle.utils');
// const resetTestEvm = require('./scripts/reset-test-evm-runnable');
// const snapshotTestEvm = require('./scripts/snapshot-test-evm-runnable');
const { execSync } = require('child_process');
const chainId = 1002;
const port = 8555;

module.exports = {
  skipFiles: [
    'Migrations.sol',
    'external/amm/SimpleFeeOwner.sol',
    'external/oracles/TestChainlinkPriceOracleV1.sol',
    'external/multisig/MultiSig.sol',
    'external/multisig/DelayedMultiSig.sol',
    'external/rebalancers/',
    'external/uniswap-v2/',
    'external/utils/MultiCall.sol',
    'external/utils/ArbitrumMultiCall.sol',
    'testing/',
  ],
  providerOptions: {
    chainId: chainId,
    keepAliveTimeout: 600000,
    mnemonic: 'myth like bonus scare over problem client lizard pioneer submit female collect',
    network_id: chainId,
    port: port,
  },
  port: port,
  mocha: {
    parallel: false, // DO NOT CHANGE
    slow: 15000, // 15 seconds
    timeout: 3600000, // 1 hour
  },
  client: require('ganache-cli'),
  configureYulOptimizer: true,
  onServerReady: async () => {
    execSync('rm -rf contracts_temp && sudo cp -r contracts/ contracts_temp/', { stdio: 'inherit' });
    execSync('python util/fix_contracts_for_coverage.py', { stdio: 'inherit' });
  },
  onCompileComplete: async () => {
    execSync('npm run deploy_coverage', { stdio: 'inherit' });
  },
};
