import { Contracts } from '../lib/Contracts';
import {
  address,
  ContractCallOptions,
  Decimal,
  Integer,
  TxResult,
} from '../types';
import { decimalToString } from '../lib/Helpers';

export class LiquidatorProxyV1 {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  public get address(): address {
    return this.contracts.liquidatorProxyV1.options.address;
  }

  // ============ State-Changing Functions ============

  public async liquidate(
    accountOwner: address,
    accountNumber: Integer,
    liquidOwner: address,
    liquidNumber: Integer,
    minLiquidatorRatio: Decimal,
    minValueLiquidated: Integer,
    owedPreferences: Integer[],
    heldPreferences: Integer[],
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.liquidatorProxyV1.methods.liquidate(
        {
          owner: accountOwner,
          number: accountNumber.toFixed(0),
        },
        {
          owner: liquidOwner,
          number: liquidNumber.toFixed(0),
        },
        {
          value: decimalToString(minLiquidatorRatio),
        },
        minValueLiquidated.toFixed(0),
        owedPreferences.map(x => x.toFixed(0)),
        heldPreferences.map(x => x.toFixed(0)),
      ),
      options,
    );
  }
}
