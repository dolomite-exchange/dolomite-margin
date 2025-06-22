require('ts-node/register'); // eslint-disable-line
require('dotenv-flow').config(); // eslint-disable-line
const HDWalletProvider = require('@truffle/hdwallet-provider'); // eslint-disable-line
const path = require('path');

const covReplicaContractsDir = path.join(process.cwd(), '.coverage_contracts');
const covContractsDir = path.join(process.cwd(), 'contracts_coverage');
const regContractsDir = path.join(process.cwd(), 'contracts');
const flatContractsDir = path.join(process.cwd(), 'out');

const regContractsOutDir = path.join(process.cwd(), 'build/contracts');
const flatContractsOutputDir = path.join(process.cwd(), 'out/build');

const pollingInterval = 10000;

module.exports = {
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY,
    arbiscan: process.env.ARBISCAN_API_KEY,
    optimistic_etherscan: process.env.OPTIMISTIC_ETHERSCAN_API_KEY,
  },
  compilers: {
    solc: {
      version: '0.5.16',
      docker: process.env.DOCKER_COMPILER === 'true',
      parser: 'solcjs',
      settings: {
        optimizer: {
          // turn off optimizations if we're running coverage tests. Coverage won't work otherwise
          enabled: !(process.env.COVERAGE_REPLICA_DEPLOY === 'true' || process.env.COVERAGE === 'true'),
          runs: 10000,
        },
        evmVersion: 'istanbul',
      },
    },
  },
  contracts_directory:
    process.env.COVERAGE_REPLICA_DEPLOY === 'true'
      ? covReplicaContractsDir
      : process.env.COVERAGE === 'true'
      ? covContractsDir
      : process.env.FLAT === 'true'
      ? flatContractsDir
      : regContractsDir,
  contracts_build_directory: process.env.FLAT === 'true' ? flatContractsOutputDir : regContractsOutDir,
  mocha: {
    parallel: false, // DO NOT CHANGE
    slow: 15000, // 15 seconds
    timeout: 3600000, // 1 hour
  },
  networks: {
    test: {
      host: '0.0.0.0',
      port: 8445,
      gasPrice: 1,
      network_id: '1001',
    },
    test_ci: {
      host: '0.0.0.0',
      port: 8545,
      gasPrice: 1,
      network_id: '1001',
    },
    dev: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gasPrice: 1000000000, // 1 gwei
      gas: 7900000,
    },
    coverage: {
      host: '127.0.0.1',
      network_id: '1002',
      port: 8555,
      gas: 0xffffffffff,
      gasPrice: 1,
      networkCheckTimeout: 60000,
    },
    // used for "replicating" the "coverage" network to get the contract addresses for running tests
    coverage_replica: {
      host: '127.0.0.1',
      network_id: '1002',
      port: 8545,
      gas: 0xffffffffff,
      gasPrice: 1,
      networkCheckTimeout: 60000,
    },
    docker: {
      host: 'localhost',
      network_id: '1313',
      port: 8545,
      gasPrice: 1,
    },
    arbitrum_one: {
      network_id: '42161',
      provider: () => {
        return new HDWalletProvider({
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: process.env.ARBITRUM_RPC_URL,
        });
      },
      gasPrice: 1000000000, // 1 gwei
      gas: 25000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      disableConfirmationListener: true,
    },
    base: {
      network_id: '8453',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: 'https://base.publicnode.com',
        });
      },
      gasPrice: 100000000, // 0.1 gwei
      gas: 25000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://api.basescan.org/api',
        apiKey: process.env.BASESCAN_API_KEY,
        explorerUrl: 'https://basescan.org/address',
      },
    },
    berachain: {
      network_id: '80094',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: process.env.BERACHAIN_RPC_URL,
        });
      },
      gasPrice: 1000000, // 0.001 gwei
      gas: 20000000, // 20M
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://api.berascan.com/api',
        apiKey: process.env.BERACHAIN_API_KEY,
        explorerUrl: 'https://berscan.com/address/',
      },
    },
    botanix: {
      network_id: '3637',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: process.env.BOTANIX_RPC_URL,
        });
      },
      gasPrice: 800000, // 0.0008 gwei
      gas: 8000000, // 8M
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://api.routescan.io/v2/network/mainnet/evm/3637/etherscan/api',
        apiKey: process.env.BOTANIXSCAN_API_KEY,
        explorerUrl: 'https://botanixscan.io/address/',
      },
    },
    ethereum_mainnet: {
      network_id: '1',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: process.env.ETHEREUM_RPC_URL,
        });
      },
      gasPrice: 1000000000, // 1.0 gwei
      gas: 20000000, // 20M
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://api.etherscan.io/api',
        apiKey: process.env.ETHERSCAN_API_KEY,
        explorerUrl: 'https://etherscan.io/address/',
      },
    },
    ink: {
      network_id: '57073',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: 'https://rpc-gel.inkonchain.com/fd96af67f38f4bf8a137b167171eeddd',
        });
      },
      gasPrice: 5000000, // 0.005 gwei
      gas: 10000000, // 10M
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://explorer.inkonchain.com/api',
        apiKey: process.env.INK_API_KEY,
        explorerUrl: 'https://explorer.inkonchain.com',
      },
    },
    mantle: {
      network_id: '5000',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: 'https://rpc.ankr.com/mantle',
        });
      },
      gasPrice: 50000000, // 0.05 gwei
      gas: 25000000000, // 25B
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://api.mantlescan.xyz/api',
        apiKey: process.env.MANTLE_API_KEY,
        explorerUrl: 'https://mantlescan.xyz',
      },
    },
    polygon_zkevm: {
      network_id: '1101',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: process.env.POLYGON_ZKEVM_RPC_URL,
        });
      },
      gasPrice: 7500000000, // 7.5 gwei
      gas: 12000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://api-zkevm.polygonscan.com/api',
        apiKey: process.env.POLYGONSCAN_API_KEY,
        explorerUrl: 'https://zkevm.polygonscan.com/address',
      },
    },
    super_seed: {
      network_id: '5330',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          // providerOrUrl: 'https://mainnet.superseed.xyz',
          providerOrUrl: 'https://magical-solemn-star.superseed-mainnet.quiknode.pro/ca608ad5d36db0699081667f87e312a5ee923627',
        });
      },
      gasPrice: 5000000, // 0.005 gwei
      gas: 10000000, // 10M
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://explorer.superseed.xyz/api',
        apiKey: process.env.SUPER_SEED_API_KEY,
        explorerUrl: 'https://explorer.superseed.xyz',
      },
    },
    x_layer: {
      network_id: '196',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          // providerOrUrl: 'https://rpc.xlayer.tech',
          providerOrUrl: 'https://rpc.ankr.com/xlayer',
        });
      },
      gasPrice: 5500000000, // 5.5 gwei
      gas: 25000000, // 25M
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER@truffle',
        apiKey: process.env.XLAYER_API_KEY,
        explorerUrl: 'https://www.oklink.com/xlayer/address',
      },
    },
  },
  plugins: ['truffle-plugin-verify', 'solidity-coverage'],
};
