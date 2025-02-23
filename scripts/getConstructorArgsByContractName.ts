import { readFileSync } from 'fs';
import path from 'path';
import { DolomiteMargin } from '../src';
import DeployedContracts from '../migrations/deployed.json';

const DEPLOY_FUNCTION_PARAMS_LENGTH = 200;

export default async function getConstructorArgsByContractName(
  contractName: string,
  provider: any,
  networkId: number,
): Promise<string> {
  const dolomiteMargin = new DolomiteMargin(provider, networkId);

  const transactionHash = DeployedContracts[contractName]?.[networkId]?.transactionHash;
  const input = (await dolomiteMargin.web3.eth.getTransaction(transactionHash)).input;
  const artifactPath = path.resolve('build', 'contracts', `${contractName}.json`);
  const artifact = JSON.parse(readFileSync(artifactPath).toString());
  const skipCreate3Deployer = contractName === 'PartiallyDelayedMultiSig';
  const constructorArgs = input.substring(
    (skipCreate3Deployer ? 0 : DEPLOY_FUNCTION_PARAMS_LENGTH) + artifact.bytecode.length,
  );
  return constructorArgs.substring(0, Math.floor(constructorArgs.length / 64) * 64);
}
