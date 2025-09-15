import { execSync } from 'child_process';
import { promisify } from 'es6-promisify';
import fs from 'fs';
import Web3 from 'web3';
import ICREATE3Factory from '../build/contracts/ICREATE3Factory.json';
import MultiCall from '../build/contracts/MultiCall.json';
import deployed from '../migrations/deployed.json';
import { ConfirmationType, DolomiteMargin } from '../src';

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

  const nodeVersion = execSync('node --version', { stdio: 'pipe' });
  if (nodeVersion.toString().trim() !== 'v20.17.0') {
    return Promise.reject(new Error('Incorrect node version! Expected v20.17.0'));
  }

  const contractName = MultiCall.contractName;
  const networkId = truffle.networks[network]['network_id'];
  const provider = truffle.networks[network].provider();
  const dolomiteMargin = new DolomiteMargin(provider, networkId);
  const deployer = (await dolomiteMargin.web3.eth.getAccounts())[0];
  console.log('Deploying from: ', deployer);

  const code = new dolomiteMargin.web3.eth.Contract(MultiCall.abi)
    .deploy({
      data: MultiCall.bytecode,
      arguments: [],
    })
    .encodeABI();
  const salt = Web3.utils.keccak256(dolomiteMargin.web3.eth.abi.encodeParameters(['string'], [contractName]));

  const factory = new dolomiteMargin.web3.eth.Contract(
    ICREATE3Factory.abi,
    '0xa8F7e7A361De6A2172fcb2accE68bd21597599F7',
  );
  const contractAddress = await dolomiteMargin.contracts.callConstantContractFunction(
    factory.methods.getDeployed(deployer, salt)
  );

  let txHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
  if ((await dolomiteMargin.web3.eth.getCode(contractAddress)) === '0x') {
    const txResult = await dolomiteMargin.contracts.callContractFunction(factory.methods.deploy(salt, code), {
      confirmationType: ConfirmationType.Confirmed,
      from: deployer,
    });
    txHash = txResult.transactionHash;
  }

  console.log(`Deployed ${contractName} to ${contractAddress}`);
  // sleeping for 5 seconds to allow for the transaction to settle before verification
  console.log('Sleeping for 5 seconds...');
  await sleep(5000);

  execSync(`truffle run verify --network ${network} ${contractName}@${contractAddress}`, {
    stdio: 'inherit',
  });

  deployed[contractName] = deployed[contractName] || {};

  deployed[contractName][networkId] = {
    links: {},
    address: contractAddress,
    transactionHash: txHash,
  };

  const json = JSON.stringify(deployed, null, 4).concat('\n');

  const directory = `${__dirname}/../migrations/`;
  const filename = 'deployed.json';
  await writeFileAsync(directory + filename, json);
  console.log(`Wrote ${filename}`);
}

// @ts-ignore
function setupLibrary(bytecode: string, libraryName: string, libraryAddress: string): string {
  const regex = new RegExp(`__${libraryName}_______________`, 'g');
  return bytecode.replace(regex, libraryAddress.substring(2));
}

deploy()
  .catch(e => {
    console.error(e.message);
    process.exit(1);
  })
  .then(() => process.exit(0));
