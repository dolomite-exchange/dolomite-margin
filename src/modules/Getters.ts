// noinspection JSUnusedGlobalSymbols

import { BigNumber } from 'bignumber.js';
import { Contracts } from '../lib/Contracts';
import { stringToDecimal, valueToInteger } from '../lib/Helpers';
import {
  AccountInfo,
  AccountStatus,
  address,
  Balance,
  ContractConstantCallOptions,
  Decimal,
  Index,
  Integer,
  Market,
  MarketWithInfo,
  Networks,
  RiskLimits,
  RiskParams,
  TotalPar, TotalWei,
  Values,
} from '../types';
import { AccountRiskOverrideSetter } from './AccountRiskOverrideSetter';
import { OracleSentinel } from './OracleSentinel';
import { ADDRESSES, INTEGERS } from '../lib/Constants';

export class Getters {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  // ============ Getters for Risk ============

  private static parseIndex({
    borrow,
    supply,
    lastUpdate,
  }: {
    borrow: string;
    supply: string;
    lastUpdate: string;
  }): Index {
    return {
      borrow: stringToDecimal(borrow),
      supply: stringToDecimal(supply),
      lastUpdate: new BigNumber(lastUpdate),
    };
  }

  private static parseTotalPar({ supply, borrow }: { supply: string; borrow: string }): TotalPar {
    return {
      borrow: new BigNumber(borrow),
      supply: new BigNumber(supply),
    };
  }

  public async getMarginRatio(options?: ContractConstantCallOptions): Promise<Decimal> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarginRatio(),
      options,
    );
    return stringToDecimal(result.value);
  }

  public async getMarginRatioForAccount(account: AccountInfo, options?: ContractConstantCallOptions): Promise<Decimal> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return this.getMarginRatio(options);
    }
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarginRatioForAccount(account),
      options,
    );
    return stringToDecimal(result.value);
  }

  public async getLiquidationSpread(options?: ContractConstantCallOptions): Promise<Decimal> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getLiquidationSpread(),
      options,
    );
    return stringToDecimal(result.value);
  }

  public async getLiquidationSpreadForPair(
    heldMarketId: Integer,
    owedMarketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Decimal> {
    const liquidationSpread = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getLiquidationSpreadForPair(
        heldMarketId.toFixed(0),
        owedMarketId.toFixed(0),
      ),
      options,
    );
    return stringToDecimal(liquidationSpread.value);
  }

  public async getLiquidationSpreadForAccountAndPair(
    account: AccountInfo,
    heldMarketId: Integer,
    owedMarketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Decimal> {
    const liquidationSpread = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getLiquidationSpreadForAccountAndPair(
        account,
        heldMarketId.toFixed(0),
        owedMarketId.toFixed(0),
      ),
      options,
    );
    return stringToDecimal(liquidationSpread.value);
  }

  public async getEarningsRate(options?: ContractConstantCallOptions): Promise<Decimal> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getEarningsRate(),
      options,
    );
    return stringToDecimal(result.value);
  }

  public async getMinBorrowedValue(options?: ContractConstantCallOptions): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMinBorrowedValue(),
      options,
    );
    return new BigNumber(result.value);
  }

  public async getOracleSentinel(options?: ContractConstantCallOptions): Promise<OracleSentinel> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve(new OracleSentinel(this.contracts, ADDRESSES.ZERO));
    }

    const oracleSentinelAddress = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getOracleSentinel(),
      options,
    );
    return new OracleSentinel(this.contracts, oracleSentinelAddress);
  }

  public async getIsBorrowAllowed(options?: ContractConstantCallOptions): Promise<boolean> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve(true);
    }

    return this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getIsBorrowAllowed(),
      options,
    );
  }

  public async getIsLiquidationAllowed(options?: ContractConstantCallOptions): Promise<boolean> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve(true);
    }

    return this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getIsLiquidationAllowed(),
      options,
    );
  }

  public async getCallbackGasLimit(options?: ContractConstantCallOptions): Promise<Integer> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve(INTEGERS.ZERO);
    }

    const value = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getCallbackGasLimit(),
      options,
    );
    return new BigNumber(value);
  }

  public async getDefaultAccountRiskOverrideSetter(
    options?: ContractConstantCallOptions,
  ): Promise<AccountRiskOverrideSetter> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve(new AccountRiskOverrideSetter(this.contracts, ADDRESSES.ZERO));
    }

    const accountRiskOverrideSetterAddress = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getDefaultAccountRiskOverrideSetter(),
      options,
    );
    return new AccountRiskOverrideSetter(this.contracts, accountRiskOverrideSetterAddress);
  }

  public async getAccountRiskOverrideSetterByAccountOwner(
    accountOwner: address,
    options?: ContractConstantCallOptions,
  ): Promise<AccountRiskOverrideSetter> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve(new AccountRiskOverrideSetter(this.contracts, ADDRESSES.ZERO));
    }

    const accountRiskOverrideSetterAddress = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountRiskOverrideSetterByAccountOwner(accountOwner),
      options,
    );
    return new AccountRiskOverrideSetter(this.contracts, accountRiskOverrideSetterAddress);
  }

  public async getAccountRiskOverrideByAccount(
    account: AccountInfo,
    options?: ContractConstantCallOptions,
  ): Promise<{ marginRatioOverride: Decimal; liquidationSpreadOverride: Decimal }> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve({
        marginRatioOverride: INTEGERS.ZERO,
        liquidationSpreadOverride: INTEGERS.ZERO,
      });
    }

    const { marginRatioOverride, liquidationSpreadOverride } = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountRiskOverrideByAccount(account),
      options,
    );
    return {
      marginRatioOverride: stringToDecimal(marginRatioOverride.value),
      liquidationSpreadOverride: stringToDecimal(liquidationSpreadOverride.value),
    };
  }

  public async getMarginRatioOverrideByAccount(
    account: AccountInfo,
    options?: ContractConstantCallOptions,
  ): Promise<Decimal> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve(INTEGERS.ZERO);
    }

    const marginRatioOverride = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarginRatioOverrideByAccount(account),
      options,
    );
    return stringToDecimal(marginRatioOverride.value);
  }

  public async getLiquidationSpreadOverrideByAccount(
    account: AccountInfo,
    options?: ContractConstantCallOptions,
  ): Promise<Decimal> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve(INTEGERS.ZERO);
    }

    const liquidationSpreadOverride = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getLiquidationSpreadOverrideByAccount(account),
      options,
    );
    return stringToDecimal(liquidationSpreadOverride.value);
  }

  public async getRiskLimits(options?: ContractConstantCallOptions): Promise<RiskLimits> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getRiskLimits(),
      options,
    );
    return {
      marginRatioMax: stringToDecimal(result[0]),
      liquidationSpreadMax: stringToDecimal(result[1]),
      earningsRateMax: stringToDecimal(result[2]),
      marginPremiumMax: stringToDecimal(result[3]),
      liquidationSpreadPremiumMax: stringToDecimal(result[4]),
      interestRateMax: stringToDecimal(result[5]),
      minBorrowedValueMax: new BigNumber(result[6]),
    };
  }

  public async getRiskParams(options?: ContractConstantCallOptions): Promise<RiskParams> {
    const result = await Promise.all([
      this.getMarginRatio(options),
      this.getLiquidationSpread(options),
      this.getEarningsRate(options),
      this.getMinBorrowedValue(options),
      this.getAccountMaxNumberOfMarketsWithBalances(options),
      this.getOracleSentinel(options),
      this.getCallbackGasLimit(options),
    ]);
    return {
      marginRatio: result[0],
      liquidationSpread: result[1],
      earningsRate: result[2],
      minBorrowedValue: result[3],
      accountMaxNumberOfMarketsWithBalances: result[4],
      oracleSentinel: result[5],
      callbackGasLimit: result[6],
    };
  }

  // ============ Getters for Markets ============

  public async getAccountMaxNumberOfMarketsWithBalances(options?: ContractConstantCallOptions): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountMaxNumberOfMarketsWithBalances(),
      options,
    );
    return new BigNumber(result);
  }

  public async getNumMarkets(options?: ContractConstantCallOptions): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getNumMarkets(),
      options,
    );
    return new BigNumber(result);
  }

  public async getMarketIdByTokenAddress(token: address, options?: ContractConstantCallOptions): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketIdByTokenAddress(token),
      options,
    );
    return new BigNumber(result);
  }

  public async getMarketTokenAddress(marketId: Integer, options?: ContractConstantCallOptions): Promise<address> {
    return this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketTokenAddress(marketId.toFixed(0)),
      options,
    );
  }

  public async getMarketIsClosing(marketId: Integer, options?: ContractConstantCallOptions): Promise<boolean> {
    return this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketIsClosing(marketId.toFixed(0)),
      options,
    );
  }

  public async getMarketPrice(marketId: Integer, options?: ContractConstantCallOptions): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketPrice(marketId.toFixed(0)),
      options,
    );
    return new BigNumber(result.value);
  }

  public async getMarketTotalPar(marketId: Integer, options?: ContractConstantCallOptions): Promise<TotalPar> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketTotalPar(marketId.toFixed(0)),
      options,
    );
    return {
      borrow: new BigNumber(result[0]),
      supply: new BigNumber(result[1]),
    };
  }

  public async getMarketTotalWei(marketId: Integer, options?: ContractConstantCallOptions): Promise<TotalWei> {
    const result = await this.getMarketTotalPar(marketId, options);
    const index = await this.getMarketCurrentIndex(marketId, options);
    return {
      borrow: result.borrow.times(index.borrow),
      supply: result.supply.times(index.supply),
    };
  }

  public async getMarketCachedIndex(marketId: Integer, options?: ContractConstantCallOptions): Promise<Index> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketCachedIndex(marketId.toFixed(0)),
      options,
    );
    return Getters.parseIndex(result);
  }

  public async getMarketCurrentIndex(marketId: Integer, options?: ContractConstantCallOptions): Promise<Index> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketCurrentIndex(marketId.toFixed(0)),
      options,
    );
    return Getters.parseIndex(result);
  }

  public async getMarketPriceOracle(marketId: Integer, options?: ContractConstantCallOptions): Promise<address> {
    return this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketPriceOracle(marketId.toFixed(0)),
      options,
    );
  }

  public async getMarketInterestSetter(marketId: Integer, options?: ContractConstantCallOptions): Promise<address> {
    return this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketInterestSetter(marketId.toFixed(0)),
      options,
    );
  }

  public async getMarketMarginPremium(marketId: Integer, options?: ContractConstantCallOptions): Promise<Decimal> {
    const marginPremium = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketMarginPremium(marketId.toFixed(0)),
      options,
    );
    return stringToDecimal(marginPremium.value);
  }

  /**
   * @deprecated
   */
  public async getMarketSpreadPremium(marketId: Integer, options?: ContractConstantCallOptions): Promise<Decimal> {
    const spreadPremium = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketSpreadPremium(marketId.toFixed(0)),
      options,
    );
    return stringToDecimal(spreadPremium.value);
  }

  public async getMarketLiquidationSpreadPremium(
    marketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Decimal> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return this.getMarketSpreadPremium(marketId, options);
    }

    const spreadPremium = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketLiquidationSpreadPremium(marketId.toFixed(0)),
      options,
    );
    return stringToDecimal(spreadPremium.value);
  }

  /**
   * @deprecated
   */
  public async getMarketMaxWei(marketId: Integer, options?: ContractConstantCallOptions): Promise<Integer> {
    const maxSupplyWei = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketMaxWei(marketId.toFixed(0)),
      options,
    );
    return valueToInteger(maxSupplyWei);
  }

  public async getMarketMaxSupplyWei(marketId: Integer, options?: ContractConstantCallOptions): Promise<Integer> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return this.getMarketMaxWei(marketId, options);
    }

    const maxSupplyWei = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketMaxSupplyWei(marketId.toFixed(0)),
      options,
    );
    return valueToInteger(maxSupplyWei);
  }

  public async getMarketMaxBorrowWei(marketId: Integer, options?: ContractConstantCallOptions): Promise<Integer> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve(INTEGERS.ZERO);
    }

    const maxBorrowWei = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketMaxBorrowWei(marketId.toFixed(0)),
      options,
    );
    return valueToInteger(maxBorrowWei);
  }

  public async getMarketEarningsRateOverride(
    marketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE) {
      return Promise.resolve(INTEGERS.ZERO);
    }

    const earningsRateOverride = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketEarningsRateOverride(marketId.toFixed(0)),
      options,
    );
    return stringToDecimal(earningsRateOverride.value);
  }

  public async getMarketUtilization(marketId: Integer, options?: ContractConstantCallOptions): Promise<Decimal> {
    const totalWei = await this.getMarketTotalWei(marketId, options);
    return totalWei.borrow.div(totalWei.supply);
  }

  /**
   * @deprecated
   */
  public async getMarketInterestRate(marketId: Integer, options?: ContractConstantCallOptions): Promise<Decimal> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketInterestRate(marketId.toFixed(0)),
      options,
    );
    return stringToDecimal(result.value);
  }

  public async getMarketBorrowInterestRatePerSecond(
    marketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Decimal> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketBorrowInterestRatePerSecond(marketId.toFixed(0)),
      options,
    );
    return stringToDecimal(result.value);
  }

  public async getMarketBorrowInterestRateApr(
    marketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Decimal> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketBorrowInterestRateApr(marketId.toFixed(0)),
      options,
    );
    return stringToDecimal(result.value);
  }

  public async getMarketSupplyInterestRateApr(
    marketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Decimal> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketSupplyInterestRateApr(marketId.toFixed(0)),
      options,
    );
    return stringToDecimal(result.value);
  }

  public async getMarket(marketId: Integer, options?: ContractConstantCallOptions): Promise<Market> {
    const market = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarket(marketId.toFixed(0)),
      options,
    );
    return {
      ...market,
      totalPar: Getters.parseTotalPar(market.totalPar),
      index: Getters.parseIndex(market.index),
      marginPremium: stringToDecimal(market.marginPremium.value),
      liquidationSpreadPremium: stringToDecimal(market.liquidationSpreadPremium.value),
      maxSupplyWei: new BigNumber(market.maxSupplyWei.value),
      maxBorrowWei: new BigNumber(market.maxBorrowWei.value),
      earningsRateOverride: stringToDecimal(market.earningsRateOverride.value),
    };
  }

  public async getMarketWithInfo(marketId: Integer, options?: ContractConstantCallOptions): Promise<MarketWithInfo> {
    const marketWithInfo = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getMarketWithInfo(marketId.toFixed(0)),
      options,
    );
    const market = marketWithInfo[0];
    const currentIndex = marketWithInfo[1];
    const currentPrice = marketWithInfo[2];
    const currentInterestRate = marketWithInfo[3];

    return {
      market: {
        ...market,
        totalPar: Getters.parseTotalPar(market.totalPar),
        index: Getters.parseIndex(market.index),
        marginPremium: stringToDecimal(market.marginPremium.value),
        liquidationSpreadPremium: stringToDecimal(market.liquidationSpreadPremium.value),
        maxSupplyWei: valueToInteger(market.maxSupplyWei),
        maxBorrowWei: valueToInteger(market.maxBorrowWei),
        earningsRateOverride: stringToDecimal(market.earningsRateOverride.value),
      },
      currentIndex: Getters.parseIndex(currentIndex),
      currentPrice: new BigNumber(currentPrice.value),
      currentInterestRate: stringToDecimal(currentInterestRate.value),
    };
  }

  public async getNumExcessTokens(marketId: Integer, options?: ContractConstantCallOptions): Promise<Integer> {
    const numExcessTokens = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getNumExcessTokens(marketId.toFixed(0)),
      options,
    );
    return valueToInteger(numExcessTokens);
  }

  // ============ Getters for Accounts ============

  public async getAccountPar(
    accountOwner: address,
    accountNumber: Integer,
    marketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountPar(
        {
          owner: accountOwner,
          number: accountNumber.toFixed(0),
        },
        marketId.toFixed(0),
      ),
      options,
    );
    return valueToInteger(result);
  }

  public async getAccountWei(
    accountOwner: address,
    accountNumber: Integer,
    marketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountWei(
        {
          owner: accountOwner,
          number: accountNumber.toFixed(0),
        },
        marketId.toFixed(0),
      ),
      options,
    );
    return valueToInteger(result);
  }

  public async getAccountStatus(
    accountOwner: address,
    accountNumber: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<AccountStatus> {
    const rawStatus = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountStatus({
        owner: accountOwner,
        number: accountNumber.toFixed(0),
      }),
      options,
    );
    switch (rawStatus) {
      case '0':
        return AccountStatus.Normal;
      case '1':
        return AccountStatus.Liquidating;
      case '2':
        return AccountStatus.Vaporizing;
      default:
        throw new Error(`invalid account status ${rawStatus}`);
    }
  }

  public async getAccountMarketsWithBalances(
    accountOwner: address,
    accountNumber: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Integer[]> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountMarketsWithBalances({
        owner: accountOwner,
        number: accountNumber.toFixed(0),
      }),
      options,
    );
    return result.map(marketIdString => new BigNumber(marketIdString));
  }

  public async getAccountNumberOfMarketsWithBalances(
    accountOwner: address,
    accountNumber: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountNumberOfMarketsWithBalances({
        owner: accountOwner,
        number: accountNumber.toFixed(0),
      }),
      options,
    );
    return new BigNumber(result);
  }

  public async getAccountMarketWithBalanceAtIndex(
    accountOwner: address,
    accountNumber: Integer,
    index: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountMarketWithBalanceAtIndex(
        {
          owner: accountOwner,
          number: accountNumber.toFixed(0),
        },
        index.toFixed(),
      ),
      options,
    );
    return new BigNumber(result);
  }

  public async getAccountNumberOfMarketsWithDebt(
    accountOwner: address,
    accountNumber: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountNumberOfMarketsWithDebt({
        owner: accountOwner,
        number: accountNumber.toFixed(0),
      }),
      options,
    );
    return new BigNumber(result);
  }

  public async getAccountValues(
    accountOwner: address,
    accountNumber: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Values> {
    let result;
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE || process.env.USE_READER === 'true') {
      result = await this.contracts.callConstantContractFunction(
        this.contracts.accountValuesReader.methods.getAccountValues({
          owner: accountOwner,
          number: accountNumber.toFixed(0),
        }),
        options,
      );
    } else {
      result = await this.contracts.callConstantContractFunction(
        this.contracts.dolomiteMargin.methods.getAccountValues({
          owner: accountOwner,
          number: accountNumber.toFixed(0),
        }),
        options,
      );
    }

    return {
      supply: new BigNumber(result[0].value),
      borrow: new BigNumber(result[1].value),
    };
  }

  public async getAdjustedAccountValues(
    accountOwner: address,
    accountNumber: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Values> {
    let result;
    if (this.contracts.getNetworkId() === Networks.ARBITRUM_ONE || process.env.USE_READER === 'true') {
      result = await this.contracts.callConstantContractFunction(
        this.contracts.accountValuesReader.methods.getAdjustedAccountValues({
          owner: accountOwner,
          number: accountNumber.toFixed(0),
        }),
        options,
      );
    } else {
      result = await this.contracts.callConstantContractFunction(
        this.contracts.dolomiteMargin.methods.getAdjustedAccountValues({
          owner: accountOwner,
          number: accountNumber.toFixed(0),
        }),
        options,
      );
    }

    return {
      supply: new BigNumber(result[0].value),
      borrow: new BigNumber(result[1].value),
    };
  }

  public async getAccountBalances(
    accountOwner: address,
    accountNumber: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Balance[]> {
    const balances = await this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getAccountBalances({
        owner: accountOwner,
        number: accountNumber.toFixed(0),
      }),
      options,
    );
    const marketIds = balances[0];
    const tokens = balances[1];
    const pars = balances[2];
    const weis = balances[3];

    const result: Balance[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      result.push({
        marketId: new BigNumber(marketIds[i]),
        tokenAddress: tokens[i],
        par: valueToInteger(pars[i]),
        wei: valueToInteger(weis[i]),
      });
    }
    return result;
  }

  public async isAccountLiquidatable(
    liquidOwner: address,
    liquidNumber: Integer,
    options: ContractConstantCallOptions = {},
  ): Promise<boolean> {
    const [accountStatus, marginRatio, accountValues] = await Promise.all([
      this.getAccountStatus(liquidOwner, liquidNumber),
      this.getMarginRatioForAccount({ owner: liquidOwner, number: liquidNumber.toFixed() }, options),
      this.getAdjustedAccountValues(liquidOwner, liquidNumber, options),
    ]);

    // return true if account has been partially liquidated
    if (accountValues.borrow.gt(0) && accountValues.supply.gt(0) && accountStatus === AccountStatus.Liquidating) {
      return true;
    }

    // return false if account is vaporizable
    if (accountValues.supply.isZero()) {
      return false;
    }

    // return true if account is undercollateralized
    const marginRequirement = accountValues.borrow.times(marginRatio);
    return accountValues.supply.lt(accountValues.borrow.plus(marginRequirement));
  }

  // ============ Getters for Permissions ============

  public async getIsLocalOperator(
    owner: address,
    operator: address,
    options?: ContractConstantCallOptions,
  ): Promise<boolean> {
    return this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getIsLocalOperator(owner, operator),
      options,
    );
  }

  public async getIsGlobalOperator(operator: address, options?: ContractConstantCallOptions): Promise<boolean> {
    return this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getIsGlobalOperator(operator),
      options,
    );
  }

  public async getIsAutoTraderSpecial(autoTrader: address, options?: ContractConstantCallOptions): Promise<boolean> {
    return this.contracts.callConstantContractFunction(
      this.contracts.dolomiteMargin.methods.getIsAutoTraderSpecial(autoTrader),
      options,
    );
  }

  // ============ Getters for Admin ============

  public async getAdmin(options?: ContractConstantCallOptions): Promise<address> {
    return this.contracts.callConstantContractFunction(this.contracts.dolomiteMargin.methods.owner(), options);
  }

  public async getExpiry(
    accountOwner: address,
    accountNumber: Integer,
    marketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.expiry.methods.getExpiry(
        {
          owner: accountOwner,
          number: accountNumber.toFixed(0),
        },
        marketId.toFixed(0),
      ),
      options,
    );
    return new BigNumber(result);
  }

  // ============ Getters for Expiry ============

  public async getExpiryPrices(
    account: AccountInfo,
    heldMarketId: Integer,
    owedMarketId: Integer,
    expiryTimestamp: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<{ heldPrice: Integer; owedPrice: Integer }> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.expiry.methods.getLiquidationSpreadAdjustedPrices(
        account,
        heldMarketId.toFixed(0),
        owedMarketId.toFixed(0),
        expiryTimestamp.toFixed(0),
      ),
      options,
    );

    return {
      heldPrice: new BigNumber(result[0].value),
      owedPrice: new BigNumber(result[1].value),
    };
  }

  public async getExpiryRampTime(options?: ContractConstantCallOptions): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.expiry.methods.g_expiryRampTime(),
      options,
    );
    return new BigNumber(result);
  }
}
