module.exports = {
  skipFiles: [
    'testing/',
    'external/uniswap-v2/',
    'external/multisig/MultiSig.sol',
    'external/multisig/DelayedMultiSig.sol',
    'Migrations.sol'
  ],
  providerOptions: {
    port: 8555,
    network_id: 1002,
  }
};
