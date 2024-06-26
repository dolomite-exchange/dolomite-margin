import BigNumber from 'bignumber.js';
import { getDolomiteMargin } from './helpers/DolomiteMargin';
import { TestDolomiteMargin } from './modules/TestDolomiteMargin';
import { resetEVM, snapshot } from './helpers/EVM';
import { setupMarkets } from './helpers/DolomiteMarginHelpers';
import { expectThrow } from './helpers/Expect';
import { address, AmountDenomination, AmountReference, INTEGERS } from '../src';

let owner: address;
let admin: address;
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
const accountOne = new BigNumber(111);
const accountTwo = new BigNumber(222);
const market = INTEGERS.ZERO;
const collateralMarket = new BigNumber(2);
const zero = new BigNumber(0);
const amount = new BigNumber(100);

describe('Closing', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    owner = dolomiteMargin.getDefaultAccount();

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    await Promise.all([
      dolomiteMargin.admin.setIsClosing(market, true, { from: admin }),
      dolomiteMargin.testing.setAccountBalance(owner, accountOne, market, amount),
      dolomiteMargin.testing.setAccountBalance(
        owner,
        accountOne,
        collateralMarket,
        amount.times(2),
      ),
      dolomiteMargin.testing.setAccountBalance(
        owner,
        accountTwo,
        collateralMarket,
        amount.times(2),
      ),
      dolomiteMargin.testing.tokenA.issueTo(
        amount,
        dolomiteMargin.address,
      ),
      dolomiteMargin.testing.tokenA.setMaximumDolomiteMarginAllowance(owner),
    ]);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  it('Succeeds for withdraw when closing', async () => {
    await dolomiteMargin.operation
      .initiate()
      .withdraw({
        primaryAccountOwner: owner,
        primaryAccountId: accountOne,
        marketId: market,
        to: owner,
        amount: {
          value: amount.times(-1),
          denomination: AmountDenomination.Actual,
          reference: AmountReference.Delta,
        },
      })
      .commit();
  });

  it('Succeeds for borrow if totalPar doesnt increase', async () => {
    await dolomiteMargin.operation
      .initiate()
      .transfer({
        primaryAccountOwner: owner,
        primaryAccountId: accountOne,
        toAccountOwner: owner,
        toAccountId: accountTwo,
        marketId: market,
        amount: {
          value: zero,
          denomination: AmountDenomination.Actual,
          reference: AmountReference.Target,
        },
      })
      .commit();
  });

  it('Fails for borrowing when closing', async () => {
    await expectThrow(
      dolomiteMargin.operation
        .initiate()
        .withdraw({
          primaryAccountOwner: owner,
          primaryAccountId: accountTwo,
          marketId: market,
          to: owner,
          amount: {
            value: amount.times(-1),
            denomination: AmountDenomination.Actual,
            reference: AmountReference.Delta,
          },
        })
        .commit(),
      'OperationImpl: Market is closing',
    );
  });
});
