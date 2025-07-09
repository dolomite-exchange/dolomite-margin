import { execSync } from 'child_process';
import { contractName } from '../build/contracts/PartiallyDelayedMultiSig.json';
import deployed from '../migrations/deployed.json';
import getConstructorArgsByContractName from './getConstructorArgsByContractName';

const truffle = require('../truffle');

const EXPECTED_NODE_VERSION = 'v20.17.0';

async function verifySingleContract(): Promise<void> {
  if (!process.env.NETWORK) {
    return Promise.reject(new Error('No NETWORK specified!'));
  }

  const nodeVersion = execSync('node --version', { stdio: 'pipe' });
  if (nodeVersion.toString().trim() !== EXPECTED_NODE_VERSION) {
    return Promise.reject(new Error(`Incorrect node version! Expected ${EXPECTED_NODE_VERSION}`));
  }

  const networkId = truffle.networks[process.env.NETWORK]['network_id'];
  const provider = truffle.networks[process.env.NETWORK].provider();
  console.log('Verification Data:', process.env.NETWORK, networkId, contractName);

  const contractAddress = deployed[contractName]?.[networkId]?.address;
  const args = await getConstructorArgsByContractName(contractName, provider, networkId);
  const constructorParam = `--forceConstructorArgs string:${args}`;
  execSync(
    `truffle run verify ${constructorParam} --network ${process.env.NETWORK} ${contractName}@${contractAddress}`,
    {
      stdio: 'inherit',
    },
  );
}

verifySingleContract()
  .catch(e => {
    console.error(e.message);
    process.exit(1);
  })
  .then(() => process.exit(0));
