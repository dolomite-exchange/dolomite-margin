import { execSync } from 'child_process';
import { promisify } from 'es6-promisify';
import fs from 'fs';
import PartiallyDelayedMultisig from '../build/contracts/PartiallyDelayedMultiSig.json';
import deployed from '../migrations/deployed.json';
import { ConfirmationType, DolomiteMargin } from '../src';
import { ethers } from 'ethers';

const truffle = require('../truffle.js');

const writeFileAsync = promisify(fs.writeFile);

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function deploy(): Promise<void> {
  const network = process.env.NETWORK;
  if (!network) {
    return Promise.reject(new Error('No NETWORK specified!'));
  }
  if (!truffle.networks[network]) {
    return Promise.reject(new Error('Invalid NETWORK specified!'));
  }

  const nodeVersion = execSync('node --version', { stdio: 'pipe' });
  if (nodeVersion.toString().trim() !== 'v16.15.1') {
    return Promise.reject(new Error('Incorrect node version! Expected v16.15.1'));
  }

  console.log(`Deploying to ${network}...`);
  const contractName = PartiallyDelayedMultisig.contractName;
  const networkId = truffle.networks[network]['network_id'];
  const provider = truffle.networks[network].provider();
  const dolomiteMargin = new DolomiteMargin(provider, networkId);
  const deployer = (await dolomiteMargin.web3.eth.getAccounts())[0];
  console.log('Deploying from:', deployer);
  console.log('Gas currency:', ethers.utils.formatEther(await dolomiteMargin.web3.eth.getBalance(deployer)));

  const contract = new dolomiteMargin.web3.eth.Contract(PartiallyDelayedMultisig.abi);
  const txResult = await dolomiteMargin.contracts.callContractFunction(
    contract.deploy({
      data: PartiallyDelayedMultisig.bytecode,
      arguments: [
        ['0x52256ef863a713Ef349ae6E97A7E8f35785145dE'],
        1,
        0,
        [],
        []
      ],
    }),
    { confirmationType: ConfirmationType.Confirmed, from: deployer },
  );

  console.log(`Deployed ${contractName} to ${txResult.contractAddress}`);
  // sleeping for 5 seconds to allow for the transaction to settle before verification
  console.log('Sleeping for 15 seconds...');
  await sleep(15_000);

  execSync(`truffle run verify --network ${network} ${contractName}@${txResult.contractAddress}`, {
    stdio: 'inherit',
  });

  deployed[contractName] = deployed[contractName] || {};

  deployed[contractName][networkId] = {
    links: {},
    address: txResult.contractAddress,
    transactionHash: txResult.transactionHash,
  };

  const json = JSON.stringify(deployed, null, 4).concat('\n');

  const directory = `${__dirname}/../migrations/`;
  const filename = 'deployed.json';
  await writeFileAsync(directory + filename, json);
  console.log(`Wrote ${filename}`);
}

deploy()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
