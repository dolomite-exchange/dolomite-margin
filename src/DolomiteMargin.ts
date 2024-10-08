/*

    Copyright 2019 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

import Web3 from 'web3';
import { Provider } from 'web3/providers';
import { Contracts } from './lib/Contracts';
import { Interest } from './lib/Interest';
import { Admin } from './modules/Admin';
import { ArbitrumGasInfo } from './modules/ArbitrumGasInfo';
import { BorrowPositionProxyV1 } from './modules/BorrowPositionProxyV1';
import { BorrowPositionProxyV2 } from './modules/BorrowPositionProxyV2';
import { DepositProxy } from './modules/DepositProxy';
import { Expiry } from './modules/Expiry';
import { GenericTraderProxyV1 } from './modules/GenericTraderProxyV1';
import { Getters } from './modules/Getters';
import { LiquidatorAssetRegistry } from './modules/LiquidatorAssetRegistry';
import { LiquidatorProxyV1 } from './modules/LiquidatorProxyV1';
import { LiquidatorProxyV4WithGenericTrader } from './modules/LiquidatorProxyV4WithGenericTrader';
import { IsolationModeUnwrapper } from './modules/IsolationModeUnwrapper';
import { Logs } from './modules/Logs';
import { MultiCall } from './modules/MultiCall';
import { Operation } from './modules/operate/Operation';
import { ChainlinkPriceOracleV1 } from './modules/oracles/ChainlinkPriceOracleV1';
import { OrderMapper } from './modules/OrderMapper';
import { Permissions } from './modules/Permissions';
import { SignedOperations } from './modules/SignedOperations';
import { StandardActions } from './modules/StandardActions';
import { SubgraphAPI } from './modules/SubgraphAPI';
import { Token } from './modules/Token';
import { TransferProxy } from './modules/TransferProxy';
import { WalletLogin } from './modules/WalletLogin';
import { PayableToken } from './modules/PayableToken';
import { address, DolomiteMarginOptions, EthereumAccount, Networks } from './types';
import { IsolationModeWrapper } from './modules/IsolationModeWrapper';
import { ExpiryProxy } from './modules/ExpiryProxy';
import { MantleGasInfo } from './modules/MantleGasInfo';

export class DolomiteMargin {
  public networkId: number;
  public web3: Web3;
  // Contract Wrappers
  public arbitrumGasInfo?: ArbitrumGasInfo;
  public admin: Admin;
  public borrowPositionProxyV1: BorrowPositionProxyV1;
  public borrowPositionProxyV2: BorrowPositionProxyV2;
  public api: SubgraphAPI;
  public chainlinkPriceOracle: ChainlinkPriceOracleV1;
  public contracts: Contracts;
  public depositWithdrawalProxy: DepositProxy;
  public expiry: Expiry;
  public expiryProxy: ExpiryProxy;
  public genericTraderProxyV1: GenericTraderProxyV1;
  public getters: Getters;
  public interest: Interest;
  public liquidatorAssetRegistry: LiquidatorAssetRegistry;
  public liquidatorProxyV1: LiquidatorProxyV1;
  public liquidatorProxyV4WithGenericTrader: LiquidatorProxyV4WithGenericTrader;
  public logs: Logs;
  public mantleGasInfo?: MantleGasInfo;
  public multiCall: MultiCall;
  public operation: Operation;
  public payableToken: PayableToken;
  public permissions: Permissions;
  public signedOperations: SignedOperations;
  public standardActions: StandardActions;
  public token: Token;
  public transferProxy: TransferProxy;
  public walletLogin: WalletLogin;

  constructor(provider: Provider | string, networkId: number = Networks.ARBITRUM_ONE, options: DolomiteMarginOptions = {}) {
    let realProvider: Provider;
    if (typeof provider === 'string') {
      realProvider = new Web3.providers.HttpProvider(provider, options.ethereumNodeTimeout || 10000);
    } else {
      realProvider = provider;
    }

    this.web3 = new Web3(realProvider);
    if (options.defaultAccount) {
      this.web3.eth.defaultAccount = options.defaultAccount;
    }
    this.contracts = this.createContractsModule(realProvider, networkId, this.web3, options);

    this.admin = new Admin(this.contracts);
    this.arbitrumGasInfo = networkId === Networks.ARBITRUM_ONE ? new ArbitrumGasInfo(this.contracts) : undefined;
    this.borrowPositionProxyV1 = new BorrowPositionProxyV1(this.contracts);
    this.borrowPositionProxyV2 = new BorrowPositionProxyV2(this.contracts);
    this.chainlinkPriceOracle = new ChainlinkPriceOracleV1(this.contracts);
    this.depositWithdrawalProxy = new DepositProxy(this.contracts);
    this.expiry = new Expiry(this.contracts);
    this.expiryProxy = new ExpiryProxy(this.contracts);
    this.genericTraderProxyV1 = new GenericTraderProxyV1(this.contracts);
    this.getters = new Getters(this.contracts);
    this.interest = new Interest(networkId);
    this.liquidatorAssetRegistry = new LiquidatorAssetRegistry(this.contracts);
    this.liquidatorProxyV1 = new LiquidatorProxyV1(this.contracts);
    this.liquidatorProxyV4WithGenericTrader = new LiquidatorProxyV4WithGenericTrader(this.contracts);
    this.logs = new Logs(this.contracts, this.web3);
    this.mantleGasInfo = networkId === Networks.MANTLE ? new MantleGasInfo(this.contracts) : undefined;
    this.multiCall = new MultiCall(this.contracts);
    this.networkId = networkId;
    this.operation = new Operation(this.contracts, new OrderMapper(this.contracts), networkId);
    this.permissions = new Permissions(this.contracts);
    this.signedOperations = new SignedOperations(this.contracts, this.web3, networkId);
    this.standardActions = new StandardActions(this.operation, this.contracts);
    this.token = new Token(this.contracts);
    this.transferProxy = new TransferProxy(this.contracts);
    this.walletLogin = new WalletLogin(this.web3, networkId);
    this.payableToken = new PayableToken(this.contracts, this.token);

    if (options.accounts) {
      options.accounts.forEach(a => this.loadAccount(a));
    }
  }

  /**
   * @return The address of the main DolomiteMargin smart contract
   */
  public get address(): address {
    return this.contracts.dolomiteMargin.options.address;
  }

  public setProvider(provider: Provider, networkId: number): void {
    this.web3.setProvider(provider);
    this.contracts.setProvider(provider, networkId);
    this.interest.setNetworkId(networkId);
  }

  public setDefaultAccount(account: address): void {
    this.web3.eth.defaultAccount = account;
    this.contracts.setDefaultAccount(account);
  }

  public getDefaultAccount(): address {
    return this.web3.eth.defaultAccount;
  }

  // ============ Helper Functions ============

  public loadAccount(account: EthereumAccount): void {
    const newAccount = this.web3.eth.accounts.wallet.add(account.privateKey);

    if (!newAccount || (account.address && account.address.toLowerCase() !== newAccount.address.toLowerCase())) {
      throw new Error(`Loaded account address mismatch.
        Expected ${account.address}, got ${newAccount ? newAccount.address : null}`);
    }
  }

  public getIsolationModeUnwrapper(unwrapperAddress: address): IsolationModeUnwrapper {
    return new IsolationModeUnwrapper(this.contracts, this.contracts.getIsolationModeUnwrapper(unwrapperAddress));
  }

  public getIsolationModeWrapper(unwrapperAddress: address): IsolationModeWrapper {
    return new IsolationModeWrapper(this.contracts, this.contracts.getIsolationModeWrapper(unwrapperAddress));
  }

  protected createContractsModule(
    provider: Provider,
    networkId: number,
    web3: Web3,
    options: DolomiteMarginOptions,
  ): any {
    return new Contracts(provider, networkId, web3, options);
  }
}
