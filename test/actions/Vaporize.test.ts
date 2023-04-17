import BigNumber from 'bignumber.js';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { resetEVM, snapshot } from '../helpers/EVM';
import { setupMarkets } from '../helpers/DolomiteMarginHelpers';
import { expectThrow } from '../helpers/Expect';
import {
  AccountStatus,
  address,
  AmountDenomination,
  AmountReference,
  Integer,
  INTEGERS,
  Vaporize,
} from '../../src';

let vaporOwner: address;
let solidOwner: address;
let operator: address;
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
const vaporAccountNumber = INTEGERS.ZERO;
const solidAccountNumber = INTEGERS.ONE;
const owedMarket = INTEGERS.ZERO;
const heldMarket = INTEGERS.ONE;
const otherMarket = new BigNumber(2);
const zero = new BigNumber(0);
const par = new BigNumber(10000);
const wei = new BigNumber(15000);
const negPar = par.times(-1);
const negWei = wei.times(-1);
const premium = new BigNumber('1.05');
let defaultGlob: Vaporize;

describe('Vaporize', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    solidOwner = dolomiteMargin.getDefaultAccount();
    vaporOwner = accounts[6];
    operator = accounts[7];
    defaultGlob = {
      primaryAccountOwner: solidOwner,
      primaryAccountId: solidAccountNumber,
      vaporAccountOwner: vaporOwner,
      vaporAccountId: vaporAccountNumber,
      vaporMarketId: owedMarket,
      payoutMarketId: heldMarket,
      amount: {
        value: zero,
        denomination: AmountDenomination.Principal,
        reference: AmountReference.Target,
      },
    };

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    const defaultIndex = {
      lastUpdate: INTEGERS.ZERO,
      borrow: wei.div(par),
      supply: wei.div(par),
    };
    await Promise.all([
      dolomiteMargin.testing.setMarketIndex(owedMarket, defaultIndex),
      dolomiteMargin.testing.setMarketIndex(heldMarket, defaultIndex),
      dolomiteMargin.testing.setAccountBalance(
        vaporOwner,
        vaporAccountNumber,
        owedMarket,
        negPar,
      ),
      dolomiteMargin.testing.setAccountBalance(
        solidOwner,
        solidAccountNumber,
        owedMarket,
        par,
      ),
    ]);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  it('Basic vaporize test', async () => {
    await issueHeldTokensToDolomiteMargin(wei.times(premium));
    await expectExcessHeldToken(wei.times(premium));
    const txResult = await expectVaporizeOkay({});
    console.log(`\tVaporize gas used: ${txResult.gasUsed}`);
    await Promise.all([
      expectExcessHeldToken(zero),
      expectVaporPars(zero, zero),
      expectSolidPars(par.times(premium), zero),
    ]);
  });

  it('Succeeds for events', async () => {
    await Promise.all([
      issueHeldTokensToDolomiteMargin(wei.times(premium)),
      dolomiteMargin.permissions.approveOperator(operator, { from: solidOwner }),
    ]);
    const txResult = await expectVaporizeOkay({}, { from: operator });
    const [heldIndex, owedIndex, heldOraclePrice, owedOraclePrice] = await Promise.all([
      dolomiteMargin.getters.getMarketCachedIndex(heldMarket),
      dolomiteMargin.getters.getMarketCachedIndex(owedMarket),
      dolomiteMargin.getters.getMarketPrice(heldMarket),
      dolomiteMargin.getters.getMarketPrice(owedMarket),
      expectExcessHeldToken(zero),
      expectVaporPars(zero, zero),
      expectSolidPars(par.times(premium), zero),
    ]);

    const logs = dolomiteMargin.logs.parseLogs(txResult);
    expect(logs.length).to.eql(8);

    const operationLog = logs[0];
    expect(operationLog.name).to.eql('LogOperation');
    expect(operationLog.args.sender).to.eql(operator);

    const owedIndexLog = logs[1];
    expect(owedIndexLog.name).to.eql('LogIndexUpdate');
    expect(owedIndexLog.args.market).to.eql(owedMarket);
    expect(owedIndexLog.args.index).to.eql(owedIndex);

    const heldIndexLog = logs[2];
    expect(heldIndexLog.name).to.eql('LogIndexUpdate');
    expect(heldIndexLog.args.market).to.eql(heldMarket);
    expect(heldIndexLog.args.index).to.eql(heldIndex);

    const owedOraclePriceLog = logs[3];
    expect(owedOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(owedOraclePriceLog.args.market).to.eql(owedMarket);
    expect(owedOraclePriceLog.args.price).to.eql(owedOraclePrice);

    const heldOraclePriceLog = logs[4];
    expect(heldOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(heldOraclePriceLog.args.market).to.eql(heldMarket);
    expect(heldOraclePriceLog.args.price).to.eql(heldOraclePrice);

    const vaporizeLog = logs[5];
    expect(vaporizeLog.name).to.eql('LogVaporize');
    expect(vaporizeLog.args.solidAccountOwner).to.eql(solidOwner);
    expect(vaporizeLog.args.solidAccountNumber).to.eql(solidAccountNumber);
    expect(vaporizeLog.args.vaporAccountOwner).to.eql(vaporOwner);
    expect(vaporizeLog.args.vaporAccountNumber).to.eql(vaporAccountNumber);
    expect(vaporizeLog.args.heldMarket).to.eql(heldMarket);
    expect(vaporizeLog.args.owedMarket).to.eql(owedMarket);
    expect(vaporizeLog.args.solidHeldUpdate).to.eql({
      newPar: par.times(premium),
      deltaWei: wei.times(premium),
    });
    expect(vaporizeLog.args.solidOwedUpdate).to.eql({
      newPar: zero,
      deltaWei: negWei,
    });
    expect(vaporizeLog.args.vaporOwedUpdate).to.eql({
      newPar: zero,
      deltaWei: wei,
    });

    // interest rates are sorted by marketId, asc
    const owedInterestRateLog = logs[6];
    expect(owedInterestRateLog.name).to.eql('LogInterestRate');
    expect(owedInterestRateLog.args.market).to.eql(owedMarket);
    expect(owedInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(owedMarket),
    );

    const heldInterestRateLog = logs[7];
    expect(heldInterestRateLog.name).to.eql('LogInterestRate');
    expect(heldInterestRateLog.args.market).to.eql(heldMarket);
    expect(heldInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(heldMarket),
    );
  });

  it('Fails for unvaporizable account', async () => {
    await dolomiteMargin.testing.setAccountBalance(
      vaporOwner,
      vaporAccountNumber,
      heldMarket,
      par,
    );
    await expectVaporizeRevert({}, 'LiquidateOrVaporizeImpl: Unvaporizable account');
  });

  it('Succeeds if enough excess owedTokens', async () => {
    await issueOwedTokensToDolomiteMargin(wei);
    await expectExcessOwedToken(wei);

    const txResult = await expectVaporizeOkay({});

    const [heldIndex, owedIndex, heldOraclePrice, owedOraclePrice] = await Promise.all([
      dolomiteMargin.getters.getMarketCachedIndex(heldMarket),
      dolomiteMargin.getters.getMarketCachedIndex(owedMarket),
      dolomiteMargin.getters.getMarketPrice(heldMarket),
      dolomiteMargin.getters.getMarketPrice(owedMarket),
      expectExcessOwedToken(zero),
      expectVaporPars(zero, zero),
      expectSolidPars(zero, par),
    ]);

    const logs = dolomiteMargin.logs.parseLogs(txResult);
    expect(logs.length).to.eql(8);

    const operationLog = logs[0];
    expect(operationLog.name).to.eql('LogOperation');
    expect(operationLog.args.sender).to.eql(solidOwner);

    const owedIndexLog = logs[1];
    expect(owedIndexLog.name).to.eql('LogIndexUpdate');
    expect(owedIndexLog.args.market).to.eql(owedMarket);
    expect(owedIndexLog.args.index).to.eql(owedIndex);

    const heldIndexLog = logs[2];
    expect(heldIndexLog.name).to.eql('LogIndexUpdate');
    expect(heldIndexLog.args.market).to.eql(heldMarket);
    expect(heldIndexLog.args.index).to.eql(heldIndex);

    const owedOraclePriceLog = logs[3];
    expect(owedOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(owedOraclePriceLog.args.market).to.eql(owedMarket);
    expect(owedOraclePriceLog.args.price).to.eql(owedOraclePrice);

    const heldOraclePriceLog = logs[4];
    expect(heldOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(heldOraclePriceLog.args.market).to.eql(heldMarket);
    expect(heldOraclePriceLog.args.price).to.eql(heldOraclePrice);

    const vaporizeLog = logs[5];
    expect(vaporizeLog.name).to.eql('LogVaporize');
    expect(vaporizeLog.args.solidAccountOwner).to.eql(solidOwner);
    expect(vaporizeLog.args.solidAccountNumber).to.eql(solidAccountNumber);
    expect(vaporizeLog.args.vaporAccountOwner).to.eql(vaporOwner);
    expect(vaporizeLog.args.vaporAccountNumber).to.eql(vaporAccountNumber);
    expect(vaporizeLog.args.heldMarket).to.eql(heldMarket);
    expect(vaporizeLog.args.owedMarket).to.eql(owedMarket);
    expect(vaporizeLog.args.solidHeldUpdate).to.eql({
      newPar: zero,
      deltaWei: zero,
    });
    expect(vaporizeLog.args.solidOwedUpdate).to.eql({
      newPar: par,
      deltaWei: zero,
    });
    expect(vaporizeLog.args.vaporOwedUpdate).to.eql({
      newPar: zero,
      deltaWei: wei,
    });

    // interest rates are sorted by marketId, asc
    const owedInterestRateLog = logs[6];
    expect(owedInterestRateLog.name).to.eql('LogInterestRate');
    expect(owedInterestRateLog.args.market).to.eql(owedMarket);
    expect(owedInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(owedMarket),
    );

    const heldInterestRateLog = logs[7];
    expect(heldInterestRateLog.name).to.eql('LogInterestRate');
    expect(heldInterestRateLog.args.market).to.eql(heldMarket);
    expect(heldInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(heldMarket),
    );
  });

  it('Succeeds if half excess owedTokens', async () => {
    const payoutAmount = wei.times(premium);
    await Promise.all([
      issueHeldTokensToDolomiteMargin(payoutAmount),
      issueOwedTokensToDolomiteMargin(wei.div(2)),
    ]);

    const txResult = await expectVaporizeOkay({});

    const [heldIndex, owedIndex, heldOraclePrice, owedOraclePrice] = await Promise.all([
      dolomiteMargin.getters.getMarketCachedIndex(heldMarket),
      dolomiteMargin.getters.getMarketCachedIndex(owedMarket),
      dolomiteMargin.getters.getMarketPrice(heldMarket),
      dolomiteMargin.getters.getMarketPrice(owedMarket),
      expectExcessHeldToken(payoutAmount.div(2)),
      expectExcessOwedToken(zero),
      expectVaporPars(zero, zero),
      expectSolidPars(par.times(premium).div(2), par.div(2)),
    ]);

    const logs = dolomiteMargin.logs.parseLogs(txResult);
    expect(logs.length).to.eql(8);

    const operationLog = logs[0];
    expect(operationLog.name).to.eql('LogOperation');
    expect(operationLog.args.sender).to.eql(solidOwner);

    const owedIndexLog = logs[1];
    expect(owedIndexLog.name).to.eql('LogIndexUpdate');
    expect(owedIndexLog.args.market).to.eql(owedMarket);
    expect(owedIndexLog.args.index).to.eql(owedIndex);

    const heldIndexLog = logs[2];
    expect(heldIndexLog.name).to.eql('LogIndexUpdate');
    expect(heldIndexLog.args.market).to.eql(heldMarket);
    expect(heldIndexLog.args.index).to.eql(heldIndex);

    const owedOraclePriceLog = logs[3];
    expect(owedOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(owedOraclePriceLog.args.market).to.eql(owedMarket);
    expect(owedOraclePriceLog.args.price).to.eql(owedOraclePrice);

    const heldOraclePriceLog = logs[4];
    expect(heldOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(heldOraclePriceLog.args.market).to.eql(heldMarket);
    expect(heldOraclePriceLog.args.price).to.eql(heldOraclePrice);

    const vaporizeLog = logs[5];
    expect(vaporizeLog.name).to.eql('LogVaporize');
    expect(vaporizeLog.args.solidAccountOwner).to.eql(solidOwner);
    expect(vaporizeLog.args.solidAccountNumber).to.eql(solidAccountNumber);
    expect(vaporizeLog.args.vaporAccountOwner).to.eql(vaporOwner);
    expect(vaporizeLog.args.vaporAccountNumber).to.eql(vaporAccountNumber);
    expect(vaporizeLog.args.heldMarket).to.eql(heldMarket);
    expect(vaporizeLog.args.owedMarket).to.eql(owedMarket);
    expect(vaporizeLog.args.solidHeldUpdate).to.eql({
      newPar: par.times(premium).div(2),
      deltaWei: wei.times(premium).div(2),
    });
    expect(vaporizeLog.args.solidOwedUpdate).to.eql({
      newPar: par.div(2),
      deltaWei: negWei.div(2),
    });
    expect(vaporizeLog.args.vaporOwedUpdate).to.eql({
      newPar: zero,
      deltaWei: wei,
    });

    // interest rates are sorted by marketId, asc
    const owedInterestRateLog = logs[6];
    expect(owedInterestRateLog.name).to.eql('LogInterestRate');
    expect(owedInterestRateLog.args.market).to.eql(owedMarket);
    expect(owedInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(owedMarket),
    );

    const heldInterestRateLog = logs[7];
    expect(heldInterestRateLog.name).to.eql('LogInterestRate');
    expect(heldInterestRateLog.args.market).to.eql(heldMarket);
    expect(heldInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(heldMarket),
    );
  });

  it('Succeeds when bound by owedToken', async () => {
    const payoutAmount = wei.times(premium);
    await issueHeldTokensToDolomiteMargin(payoutAmount.times(2));

    await expectVaporizeOkay({
      amount: {
        value: par.times(2),
        denomination: AmountDenomination.Principal,
        reference: AmountReference.Delta,
      },
    });

    await Promise.all([
      expectExcessHeldToken(payoutAmount),
      expectVaporPars(zero, zero),
      expectSolidPars(par.times(premium), zero),
    ]);
  });

  it('Succeeds when bound by heldToken', async () => {
    const payoutAmount = wei.times(premium).div(2);
    await issueHeldTokensToDolomiteMargin(payoutAmount);

    await expectVaporizeOkay({});

    await Promise.all([
      expectExcessHeldToken(zero),
      expectVaporPars(zero, negPar.div(2)),
      expectSolidPars(par.times(premium).div(2), par.div(2)),
    ]);
  });

  it('Succeeds for account already marked with liquidating flag', async () => {
    const payoutAmount = wei.times(premium);
    await Promise.all([
      issueHeldTokensToDolomiteMargin(payoutAmount),
      dolomiteMargin.testing.setAccountStatus(
        vaporOwner,
        vaporAccountNumber,
        AccountStatus.Liquidating,
      ),
    ]);

    await expectVaporizeOkay({});

    await Promise.all([
      expectExcessHeldToken(zero),
      expectVaporPars(zero, zero),
      expectSolidPars(par.times(premium), zero),
    ]);
  });

  it('Succeeds for account already marked with vaporizing flag', async () => {
    const payoutAmount = wei.times(premium);
    await Promise.all([
      issueHeldTokensToDolomiteMargin(payoutAmount),
      dolomiteMargin.testing.setAccountStatus(
        vaporOwner,
        vaporAccountNumber,
        AccountStatus.Vaporizing,
      ),
    ]);

    await expectVaporizeOkay({});

    await Promise.all([
      expectExcessHeldToken(zero),
      expectVaporPars(zero, zero),
      expectSolidPars(par.times(premium), zero),
    ]);
  });

  it('Succeeds for solid account that takes on a negative balance', async () => {
    const payoutAmount = wei.times(premium);
    await Promise.all([
      issueHeldTokensToDolomiteMargin(payoutAmount),
      dolomiteMargin.testing.setAccountBalance(
        solidOwner,
        solidAccountNumber,
        owedMarket,
        par.div(2),
      ),
      // need another positive balance so there is zero (or negative) excess owedToken
      dolomiteMargin.testing.setAccountBalance(
        operator,
        solidAccountNumber,
        owedMarket,
        par,
      ),
    ]);
    await expectVaporizeOkay({});
    await Promise.all([
      expectExcessHeldToken(zero),
      expectVaporPars(zero, zero),
      expectSolidPars(par.times(premium), negPar.div(2)),
    ]);
  });

  it('Succeeds and sets status to Normal', async () => {
    const payoutAmount = wei.times(premium);
    await Promise.all([
      issueHeldTokensToDolomiteMargin(payoutAmount),
      dolomiteMargin.testing.setAccountStatus(
        solidOwner,
        solidAccountNumber,
        AccountStatus.Liquidating,
      ),
    ]);
    await expectVaporizeOkay({});
    const status = await dolomiteMargin.getters.getAccountStatus(
      solidOwner,
      solidAccountNumber,
    );
    expect(status).to.eql(AccountStatus.Normal);
  });

  it('Succeeds for local operator', async () => {
    const payoutAmount = wei.times(premium);
    await Promise.all([
      issueHeldTokensToDolomiteMargin(payoutAmount),
      dolomiteMargin.permissions.approveOperator(operator, { from: solidOwner }),
    ]);
    await expectVaporizeOkay({}, { from: operator });
    await Promise.all([
      expectExcessHeldToken(zero),
      expectVaporPars(zero, zero),
      expectSolidPars(par.times(premium), zero),
    ]);
  });

  it('Succeeds for global operator', async () => {
    const payoutAmount = wei.times(premium);
    await Promise.all([
      issueHeldTokensToDolomiteMargin(payoutAmount),
      dolomiteMargin.admin.setGlobalOperator(operator, true, { from: accounts[0] }),
    ]);
    await expectVaporizeOkay({}, { from: operator });
    await Promise.all([
      expectExcessHeldToken(zero),
      expectVaporPars(zero, zero),
      expectSolidPars(par.times(premium), zero),
    ]);
  });

  it('Succeeds (without effect) for zero excess', async () => {
    await expectExcessHeldToken(zero);
    await expectVaporizeOkay({});
    await Promise.all([
      expectExcessHeldToken(zero),
      expectVaporPars(zero, negPar),
      expectSolidPars(zero, par),
    ]);
  });

  it('Succeeds (without effect) for zero borrow', async () => {
    const payoutAmount = wei.times(premium);
    await issueHeldTokensToDolomiteMargin(payoutAmount);
    await expectVaporizeOkay({
      vaporMarketId: otherMarket,
    });
    await Promise.all([
      expectExcessHeldToken(payoutAmount),
      expectVaporPars(zero, negPar),
      expectSolidPars(zero, par),
    ]);
  });

  it('Fails for non-operator', async () => {
    const payoutAmount = wei.times(premium);
    await issueHeldTokensToDolomiteMargin(payoutAmount);
    await expectVaporizeRevert({}, 'Storage: Unpermissioned operator', {
      from: operator,
    });
  });

  it('Fails if vaporizing after account used as primary', async () => {
    await dolomiteMargin.permissions.approveOperator(solidOwner, { from: vaporOwner });
    const operation = dolomiteMargin.operation.initiate();
    operation.deposit({
      primaryAccountOwner: vaporOwner,
      primaryAccountId: vaporAccountNumber,
      marketId: owedMarket,
      from: vaporOwner,
      amount: {
        value: par.div(2),
        denomination: AmountDenomination.Principal,
        reference: AmountReference.Delta,
      },
    });
    operation.vaporize(defaultGlob);
    await expectThrow(
      operation.commit(),
      'OperationImpl: Requires non-primary account',
    );
  });

  it('Fails if vaporizing totally zero account', async () => {
    await expectVaporizeRevert(
      {
        vaporAccountOwner: operator,
        vaporAccountId: zero,
      },
      'LiquidateOrVaporizeImpl: Unvaporizable account',
    );
  });

  it('Fails for repeated market', async () => {
    await expectVaporizeRevert(
      { payoutMarketId: owedMarket },
      'OperationImpl: Duplicate markets in action',
    );
  });

  it('Fails for negative excess heldTokens', async () => {
    await dolomiteMargin.testing.setAccountBalance(
      solidOwner,
      solidAccountNumber,
      heldMarket,
      par,
    );
    await expectExcessHeldToken(negWei);
    await expectVaporizeRevert({}, 'LiquidateOrVaporizeImpl: Excess cannot be negative');
  });

  it('Fails for a negative delta', async () => {
    await expectVaporizeRevert(
      {
        amount: {
          value: negPar.times(2),
          denomination: AmountDenomination.Principal,
          reference: AmountReference.Target,
        },
      },
      'Storage: Owed balance cannot increase',
    );
  });

  it('Fails to vaporize the same account', async () => {
    await expectVaporizeRevert(
      {
        vaporAccountOwner: solidOwner,
        vaporAccountId: solidAccountNumber,
      },
      'OperationImpl: Duplicate accounts in action',
    );
  });
});

// ============ Helper Functions ============

async function issueHeldTokensToDolomiteMargin(amount: BigNumber) {
  return dolomiteMargin.testing.tokenB.issueTo(
    amount,
    dolomiteMargin.address,
  );
}

async function issueOwedTokensToDolomiteMargin(amount: BigNumber) {
  return dolomiteMargin.testing.tokenA.issueTo(
    amount,
    dolomiteMargin.address,
  );
}

async function expectVaporizeOkay(glob: Object, options?: Object) {
  const combinedGlob = { ...defaultGlob, ...glob };
  return dolomiteMargin.operation
    .initiate()
    .vaporize(combinedGlob)
    .commit(options);
}

async function expectVaporizeRevert(
  glob: Object,
  reason?: string,
  options?: Object,
) {
  await expectThrow(expectVaporizeOkay(glob, options), reason);
}

async function expectSolidPars(
  expectedHeldPar: Integer,
  expectedOwedPar: Integer,
) {
  const balances = await dolomiteMargin.getters.getAccountBalances(
    solidOwner,
    solidAccountNumber,
  );
  balances.forEach((balance) => {
    if (balance.marketId.eq(heldMarket)) {
      expect(balance.par).to.eql(expectedHeldPar);
    } else if (balance.marketId.eq(owedMarket)) {
      expect(balance.par).to.eql(expectedOwedPar);
    } else {
      expect(balance.par).to.eql(zero);
    }
  });
}

async function expectVaporPars(
  expectedHeldPar: Integer,
  expectedOwedPar: Integer,
) {
  const balances = await dolomiteMargin.getters.getAccountBalances(
    vaporOwner,
    vaporAccountNumber,
  );
  balances.forEach((balance) => {
    if (balance.marketId.eq(heldMarket)) {
      expect(balance.par).to.eql(expectedHeldPar);
    } else if (balance.marketId.eq(owedMarket)) {
      expect(balance.par).to.eql(expectedOwedPar);
    } else {
      expect(balance.par).to.eql(zero);
    }
  });
}

async function expectExcessHeldToken(expected: Integer) {
  const actual = await dolomiteMargin.getters.getNumExcessTokens(heldMarket);
  expect(actual).to.eql(expected);
}

async function expectExcessOwedToken(expected: Integer) {
  const actual = await dolomiteMargin.getters.getNumExcessTokens(owedMarket);
  expect(actual).to.eql(expected);
}
