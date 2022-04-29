import BigNumber from 'bignumber.js';
import { TestContracts } from './TestContracts';
import {
  address,
  ContractCallOptions,
  Integer,
  TxResult,
} from '../../src';

export class TestPriceOracle {
  private contracts: TestContracts;

  constructor(contracts: TestContracts) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testPriceOracle.options.address;
  }

  public async setPrice(
    token: address,
    price: Integer,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.testPriceOracle.methods.setPrice(token, price.toFixed(0)),
      options,
    );
  }

  public async getPrice(token: address): Promise<Integer> {
    const price = await this.contracts.callConstantContractFunction(
      this.contracts.testPriceOracle.methods.getPrice(token),
    );
    return new BigNumber(price.value);
  }
}
