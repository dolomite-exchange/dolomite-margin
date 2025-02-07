import { Contracts } from '../lib/Contracts';
import { Token } from './Token';
import { WETH as PayableTokenContract } from '../../build/wrappers/WETH';
import {
  address,
  ContractCallOptions,
  ContractConstantCallOptions,
  Integer,
  TxResult,
} from '../types';

export class PayableToken {
  private contracts: Contracts;
  private token: Token;
  private payableToken: PayableTokenContract;

  constructor(contracts: Contracts, token: Token) {
    this.contracts = contracts;
    this.token = token;
    this.payableToken = contracts.payableToken;
    if (!contracts.payableToken.options.address) {
      throw new Error('No payable token found!');
    }
  }

  public get address(): string {
    return this.payableToken.options.address;
  }

  public async wrap(
    ownerAddress: address,
    amount: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(this.payableToken.methods.deposit(), {
      ...options,
      from: ownerAddress,
      value: amount.toFixed(0),
    });
  }

  public async unwrap(
    ownerAddress: address,
    amount: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.payableToken.methods.withdraw(amount.toFixed(0)),
      {
        ...options,
        from: ownerAddress,
      },
    );
  }

  public async getAllowance(
    ownerAddress: address,
    spenderAddress: address,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    return this.token.getAllowance(
      this.payableToken.options.address,
      ownerAddress,
      spenderAddress,
      options,
    );
  }

  public async getBalance(
    ownerAddress: address,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    return this.token.getBalance(
      this.payableToken.options.address,
      ownerAddress,
      options,
    );
  }

  public async getTotalSupply(
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    return this.token.getTotalSupply(this.payableToken.options.address, options);
  }

  public async getName(options?: ContractConstantCallOptions): Promise<string> {
    return this.token.getName(this.payableToken.options.address, options);
  }

  public async getSymbol(
    options?: ContractConstantCallOptions,
  ): Promise<string> {
    return this.token.getSymbol(this.payableToken.options.address, options);
  }

  public async getDecimals(
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    return this.token.getDecimals(this.payableToken.options.address, options);
  }

  public async getDolomiteMarginAllowance(
    ownerAddress: address,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    return this.token.getDolomiteMarginAllowance(
      this.payableToken.options.address,
      ownerAddress,
      options,
    );
  }

  public async setAllowance(
    ownerAddress: address,
    spenderAddress: address,
    amount: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.token.setAllowance(
      this.payableToken.options.address,
      ownerAddress,
      spenderAddress,
      amount,
      options,
    );
  }

  public async setDolomiteMarginAllowance(
    ownerAddress: address,
    amount: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.token.setDolomiteMarginllowance(
      this.payableToken.options.address,
      ownerAddress,
      amount,
      options,
    );
  }

  public async setMaximumAllowance(
    ownerAddress: address,
    spenderAddress: address,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.token.setMaximumAllowance(
      this.payableToken.options.address,
      ownerAddress,
      spenderAddress,
      options,
    );
  }

  public async setMaximumDolomiteMarginAllowance(
    ownerAddress: address,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.token.setMaximumDolomiteMarginAllowance(
      this.payableToken.options.address,
      ownerAddress,
      options,
    );
  }

  public async unsetDolomiteMarginAllowance(
    ownerAddress: address,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.token.unsetDolomiteMarginAllowance(
      this.payableToken.options.address,
      ownerAddress,
      options,
    );
  }

  public async transfer(
    fromAddress: address,
    toAddress: address,
    amount: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.token.transfer(
      this.payableToken.options.address,
      fromAddress,
      toAddress,
      amount,
      options,
    );
  }

  public async transferFrom(
    fromAddress: address,
    toAddress: address,
    senderAddress: address,
    amount: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.token.transferFrom(
      this.payableToken.options.address,
      fromAddress,
      toAddress,
      senderAddress,
      amount,
      options,
    );
  }
}
