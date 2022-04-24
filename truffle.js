require('ts-node/register'); // eslint-disable-line
require('dotenv-flow').config(); // eslint-disable-line
const HDWalletProvider = require('@truffle/hdwallet-provider'); // eslint-disable-line

module.exports = {
  compilers: {
    solc: {
      version: '0.5.16',
      docker: process.env.DOCKER_COMPILER !== undefined
        ? process.env.DOCKER_COMPILER === 'true' : true,
      parser: 'solcjs',
      settings: {
        optimizer: {
          enabled: true,
          runs: 10000,
        },
        evmVersion: 'istanbul',
      },
    },
  },
  networks: {
    test: {
      host: '0.0.0.0',
      port: 8445,
      gasPrice: 1e9,
      network_id: '1001',
    },
    test_ci: {
      host: '0.0.0.0',
      port: 8545,
      gasPrice: 1,
      network_id: '1001',
    },
    mainnet: {
      network_id: '1',
      provider: () => new HDWalletProvider(process.env.DEPLOYER_PRIVATE_KEY, process.env.NODE_URL),
      gasPrice: Number(process.env.GAS_PRICE),
      gas: 6900000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
    },
    kovan: {
      network_id: '42',
      provider: () => new HDWalletProvider(
        [process.env.DEPLOYER_PRIVATE_KEY],
        'http://54.235.26.63:8545',
        0,
        1,
      ),
      gasPrice: 37000000000, // 37 gwei
      gas: 6900000,
      from: process.env.DEPLOYER_ACCOUNT,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
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
    docker: {
      host: 'localhost',
      network_id: '1313',
      port: 8545,
      gasPrice: 1,
    },
    matic: {
      network_id: '137',
      provider: () => new HDWalletProvider(
        [process.env.DEPLOYER_PRIVATE_KEY],
        'https://rpc-mainnet.maticvigil.com',
        0,
        1,
      ),
      gasPrice: 5000000000,
      gas: 7900000,
      confirmations: 1,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
    },
    mumbai_matic: {
      network_id: '80001',
      provider: () => new HDWalletProvider(
        [process.env.DEPLOYER_PRIVATE_KEY],
        "https://rpc-mumbai.maticvigil.com",
        0,
        1,
      ),
      gasPrice: 5e9,
      gas: 7900000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
    },
    arbitrum: {
      network_id: 42161,
      provider: () => {
        return new HDWalletProvider(
          [process.env.DEPLOYER_PRIVATE_KEY],
          process.env.ARBITRUM_NODE_URL
        )
      },
      gasPrice: 1000000000, // 1 gwei
      gas: 100000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 1,
      disableConfirmationListener: true,
    },
    arbitrum_rinkeby: {
      network_id: 421611,
      provider: () => {
        return new HDWalletProvider(
          [process.env.DEPLOYER_PRIVATE_KEY],
          process.env.ARBITRUM_RINKEBY_NODE_URL
        )
      },
      gasPrice: 100000000, // 0.1 gwei
      gas: 100000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 1,
      disableConfirmationListener: true,
    }
  },
  plugins: ['truffle-plugin-verify', 'solidity-coverage'],
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY,
    arbiscan: process.env.ARBISCAN_API_KEY,
    optimistic_etherscan: process.env.OPTIMISTIC_ETHERSCAN_API_KEY,
    polygonscan: process.env.POLYGONSCAN_API_KEY,
  }
};
