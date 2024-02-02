import { Contracts } from '../lib/Contracts';
import { ActionArgs, address, Integer } from '../types';
import { hexStringToBytes, toBytesNoPadding } from '../lib/BytesHelper';
import { IIsolationModeUnwrapperTrader } from '../../build/wrappers/IIsolationModeUnwrapperTrader';
import BigNumber from 'bignumber.js';

export class IsolationModeUnwrapper {
  public unwrapperContract: IIsolationModeUnwrapperTrader;
  private contracts: Contracts;

  constructor(contracts: Contracts, unwrapperContract: IIsolationModeUnwrapperTrader) {
    this.contracts = contracts;
    this.unwrapperContract = unwrapperContract;
  }

  public get address(): address {
    return this.unwrapperContract.options.address;
  }

  public async token(): Promise<address> {
    return this.contracts.callConstantContractFunction(this.unwrapperContract.methods.token());
  }

  public async actionsLength(): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(this.unwrapperContract.methods.actionsLength());
    return new BigNumber(result);
  }

  public async createActionsForUnwrapping(
    solidAccountId: Integer,
    liquidAccountId: Integer,
    solidAccountOwner: address,
    solidAccountNumber: Integer,
    liquidAccountOwner: address,
    liquidAccountNumber: Integer,
    outputMarket: Integer,
    inputMarket: Integer,
    minOutputAmount: Integer,
    inputAmount: Integer,
    orderDataHexString: string,
  ): Promise<ActionArgs[]> {
    return this.contracts.callConstantContractFunction(
      this.unwrapperContract.methods.createActionsForUnwrapping({
        primaryAccountId: solidAccountId.toFixed(),
        otherAccountId: liquidAccountId.toFixed(),
        primaryAccountOwner: solidAccountOwner,
        primaryAccountNumber: solidAccountNumber.toFixed(),
        otherAccountOwner: liquidAccountOwner,
        otherAccountNumber: liquidAccountNumber.toFixed(),
        outputMarket: outputMarket.toFixed(),
        inputMarket: inputMarket.toFixed(),
        minOutputAmount: minOutputAmount.toFixed(),
        inputAmount: inputAmount.toFixed(),
        orderData: toBytesNoPadding(orderDataHexString),
      }),
    );
  }

  public async getExchangeCost(
    makerToken: address,
    takerToken: address,
    desiredMakerToken: Integer,
    orderData: string,
  ): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.unwrapperContract.methods.getExchangeCost(
        makerToken,
        takerToken,
        desiredMakerToken.toFixed(),
        hexStringToBytes(orderData),
      ),
    );
    return new BigNumber(result);
  }
}
