import { abi, bytecode, contractName } from '../build/contracts/AAVECopyCatStableCoinInterestSetter.json';
import { ConfirmationType, DolomiteMargin } from '../src';
import { AAVECopyCatStableCoinInterestSetter } from '../build/wrappers/AAVECopyCatStableCoinInterestSetter';
import { execSync } from 'child_process';
import deployed from '../migrations/deployed.json';
import { promisify } from 'es6-promisify';
import fs from 'fs';
const truffle = require('../truffle');
const writeFileAsync = promisify(fs.writeFile);

async function deploy(): Promise<void> {
  if (!process.env.NETWORK) {
    return Promise.reject(new Error('No NETWORK specified!'));
  }

  const nodeVersion = execSync('node --version', { stdio: 'pipe' });
  if (nodeVersion.toString().trim() !== 'v14.17.0') {
    return Promise.reject(new Error('Incorrect node version! Expected v14.17.0'));
  }

  const networkId = truffle.networks[process.env.NETWORK]['network_id'];
  const provider = truffle.networks[process.env.NETWORK].provider();
  const dolomiteMargin = new DolomiteMargin(provider, networkId);
  const deployer = (await dolomiteMargin.web3.eth.getAccounts())[0];
  const contract = new dolomiteMargin.web3.eth.Contract(abi) as AAVECopyCatStableCoinInterestSetter;
  const txResult = await dolomiteMargin.contracts.callContractFunction(
    contract.deploy({
      data: bytecode,
      arguments: [],
    }),
    { confirmationType: ConfirmationType.Confirmed, gas: '15000000', gasPrice: '1000000000', from: deployer },
  );

  execSync(`truffle run verify --network ${process.env.NETWORK} ${contractName}@${txResult.contractAddress}`, {
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
  .catch(e => {
    console.error(e.message);
    process.exit(1);
  })
  .then(() => process.exit(0));
