import { execSync } from 'child_process';
import { promisify } from 'es6-promisify';
import fs from 'fs';
import LiquidatorProxyV4WithGenericTrader from '../build/contracts/LiquidatorProxyV4WithGenericTrader.json';
import deployed from '../migrations/deployed.json';
import { ConfirmationType, DolomiteMargin } from '../src';

const truffle = require('../truffle.js');
const { getChainId } = require('../migrations/helpers.js');

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

  const contractName = LiquidatorProxyV4WithGenericTrader.contractName;
  const networkId = truffle.networks[network]['network_id'];
  const provider = truffle.networks[network].provider();
  const dolomiteMargin = new DolomiteMargin(provider, networkId);
  const deployer = (await dolomiteMargin.web3.eth.getAccounts())[0];
  console.log('Deploying from: ', deployer);

  const contract = new dolomiteMargin.web3.eth.Contract(LiquidatorProxyV4WithGenericTrader.abi);
  const chainId = getChainId(network);
  const txResult = await dolomiteMargin.contracts.callContractFunction(
    contract.deploy({
      data: LiquidatorProxyV4WithGenericTrader.bytecode,
      arguments: [
        chainId,
        deployed.Expiry[chainId].address,
        deployed.DolomiteMargin[chainId].address,
        deployed.LiquidatorAssetRegistry[chainId].address,
      ],
    }),
    { confirmationType: ConfirmationType.Confirmed, from: deployer },
  );

  console.log(`Deployed ${contractName} to ${txResult.contractAddress}`);
  // sleeping for 5 seconds to allow for the transaction to settle before verification
  console.log('Sleeping for 5 seconds...');
  await sleep(5000);

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
