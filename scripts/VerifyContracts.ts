import { execSync } from 'child_process';
import deployed from '../migrations/deployed.json';
import getConstructorArgsByContractName from './getConstructorArgsByContractName';

const truffleConfig = require('../truffle.js');

async function verifyAll(): Promise<void> {
  if (!process.env.NETWORK) {
    return Promise.reject(new Error('No NETWORK specified!'));
  }

  const keys = Object.keys(deployed);
  const provider = truffleConfig.networks[process.env.NETWORK].provider();
  const networkId = truffleConfig.networks[process.env.NETWORK]['network_id'];
  console.log('Looking for contracts with network ID:', networkId);

  for (let i = 0; i < keys.length; i += 1) {
    const contract = deployed[keys[i]][networkId];
    if (
      contract &&
      contract.address &&
      !keys[i].toLowerCase().includes('AmmRebalancer'.toLowerCase()) &&
      keys[i] > '' // Used to skip contracts if needed
    ) {
      try {
        const contractName = contract.contractName ?? keys[i];
        const constructorArgs = await getConstructorArgsByContractName(contractName, provider, networkId);
        execSync(
          `truffle run verify --forceConstructorArgs string:${constructorArgs} --network ${process.env.NETWORK} ${contractName}@${contract.address}`,
          {
            stdio: 'inherit',
          },
        );
        // eslint-disable-next-line no-empty
      } catch (e) {}
    } else {
      console.warn('No contract found for key:', keys[i]);
    }
    console.log('');
  }
}

verifyAll()
  .catch(e => {
    console.error(e.message);
    process.exit(1);
  })
  .then(() => process.exit(0));
