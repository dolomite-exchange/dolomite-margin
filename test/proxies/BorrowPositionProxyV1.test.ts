import BigNumber from 'bignumber.js';
import { address, BalanceCheckFlag, Integer, INTEGERS } from '../../src';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { resetEVM, snapshot } from '../helpers/EVM';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { setupMarkets } from '../helpers/DolomiteMarginHelpers';
import { expectThrowInvalidBalance } from '../helpers/Expect';

let dolomiteMargin: TestDolomiteMargin;
let snapshotId: string;
let owner1: address;

const fromAccountNumber = INTEGERS.ZERO;
const borrowAccountNumber = new BigNumber(1337);
const market1 = INTEGERS.ZERO;
const market2 = INTEGERS.ONE;
const wei1 = new BigNumber(500);
const weiBig1 = new BigNumber(550);
const wei2 = new BigNumber(100);
const negativeBalanceWei1 = wei1.minus(weiBig1);
const defaultBalanceCheckFlag = BalanceCheckFlag.None;

describe('BorrowPositionProxyV1', () => {
  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    owner1 = dolomiteMargin.getDefaultAccount();
    await resetEVM();
    await setupMarkets(dolomiteMargin, r.accounts);
    const [token1, token2] = [
      await dolomiteMargin.getters.getMarketTokenAddress(market1),
      await dolomiteMargin.getters.getMarketTokenAddress(market2),
    ];
    await Promise.all([
      dolomiteMargin.testing.priceOracle.setPrice(token1, new BigNumber('1e40')),
      dolomiteMargin.testing.priceOracle.setPrice(token2, new BigNumber('1e40')),
    ]);
    await dolomiteMargin.testing.setAccountBalance(owner1, fromAccountNumber, market1, wei1);
    await dolomiteMargin.testing.setAccountBalance(owner1, fromAccountNumber, market2, wei2);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#openBorrowPosition', () => {
    it('should work normally', async () => {
      await expectBalances(owner1, fromAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market1, INTEGERS.ZERO);

      await dolomiteMargin.borrowPositionProxyV1.openBorrowPosition(
        fromAccountNumber,
        borrowAccountNumber,
        market1,
        wei1,
        defaultBalanceCheckFlag,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);
    });

    it('should work when balanceCheckFlag is set to None and user goes negative', async () => {
      await expectBalances(owner1, fromAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market1, INTEGERS.ZERO);

      await dolomiteMargin.borrowPositionProxyV1.openBorrowPosition(
        fromAccountNumber,
        borrowAccountNumber,
        market1,
        weiBig1,
        BalanceCheckFlag.None,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, negativeBalanceWei1);
      await expectBalances(owner1, borrowAccountNumber, market1, weiBig1);
    });

    it('should not work user goes negative and flag is set to Both or From', async () => {
      await expectBalances(owner1, fromAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market1, INTEGERS.ZERO);

      await expectThrowInvalidBalance(
        dolomiteMargin.borrowPositionProxyV1.openBorrowPosition(
          fromAccountNumber,
          borrowAccountNumber,
          market1,
          weiBig1,
          BalanceCheckFlag.From,
          { from: owner1 },
        ),
        owner1,
        fromAccountNumber,
        market1,
      );
      await expectThrowInvalidBalance(
        dolomiteMargin.borrowPositionProxyV1.openBorrowPosition(
          fromAccountNumber,
          borrowAccountNumber,
          market1,
          weiBig1,
          BalanceCheckFlag.Both,
          { from: owner1 },
        ),
        owner1,
        fromAccountNumber,
        market1,
      );
    });
  });

  describe('#transferBetweenAccounts', () => {
    it('success case to borrow and repay some of the debt', async () => {
      await expectBalances(owner1, fromAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market1, INTEGERS.ZERO);

      await dolomiteMargin.borrowPositionProxyV1.openBorrowPosition(
        fromAccountNumber,
        borrowAccountNumber,
        market1,
        wei1,
        defaultBalanceCheckFlag,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);

      await dolomiteMargin.borrowPositionProxyV1.transferBetweenAccounts(
        borrowAccountNumber,
        fromAccountNumber,
        market2,
        wei2,
        defaultBalanceCheckFlag,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, fromAccountNumber, market2, wei2.times(2));
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market2, wei2.times(-1));

      await dolomiteMargin.borrowPositionProxyV1.transferBetweenAccounts(
        fromAccountNumber,
        borrowAccountNumber,
        market2,
        wei2.div(2),
        defaultBalanceCheckFlag,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, fromAccountNumber, market2, wei2.times(1.5));
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market2, wei2.times(-0.5));
    });

    it('should fail when BalanceCheckFlag is set to To or Both and borrow account has debt still', async () => {
      await expectBalances(owner1, fromAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market1, INTEGERS.ZERO);

      await dolomiteMargin.borrowPositionProxyV1.openBorrowPosition(
        fromAccountNumber,
        borrowAccountNumber,
        market1,
        weiBig1,
        defaultBalanceCheckFlag,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, negativeBalanceWei1);
      await expectBalances(owner1, borrowAccountNumber, market1, weiBig1);

      await dolomiteMargin.borrowPositionProxyV1.transferBetweenAccounts(
        borrowAccountNumber,
        fromAccountNumber,
        market2,
        wei2,
        defaultBalanceCheckFlag,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, negativeBalanceWei1);
      await expectBalances(owner1, fromAccountNumber, market2, wei2.times(2));
      await expectBalances(owner1, borrowAccountNumber, market1, weiBig1);
      await expectBalances(owner1, borrowAccountNumber, market2, wei2.times(-1));

      await expectThrowInvalidBalance(
        dolomiteMargin.borrowPositionProxyV1.transferBetweenAccounts(
          fromAccountNumber,
          borrowAccountNumber,
          market2,
          wei2.div(2),
          BalanceCheckFlag.To,
          { from: owner1 },
        ),
        owner1,
        borrowAccountNumber,
        market2,
      );
      // fromAccount takes priority and is checked first, BUT market2 is all good for fromAccount
      await expectThrowInvalidBalance(
        dolomiteMargin.borrowPositionProxyV1.transferBetweenAccounts(
          fromAccountNumber,
          borrowAccountNumber,
          market2,
          wei2.div(2),
          BalanceCheckFlag.Both,
          { from: owner1 },
        ),
        owner1,
        borrowAccountNumber,
        market2,
      );
      await expectThrowInvalidBalance(
        dolomiteMargin.borrowPositionProxyV1.transferBetweenAccounts(
          fromAccountNumber,
          borrowAccountNumber,
          market1,
          new BigNumber(1),
          BalanceCheckFlag.Both,
          { from: owner1 },
        ),
        owner1,
        fromAccountNumber,
        market1,
      );
    });
  });

  describe('#repayAllForBorrowPosition', () => {
    it('success case to borrow and repay debt', async () => {
      await expectBalances(owner1, fromAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market1, INTEGERS.ZERO);

      await dolomiteMargin.borrowPositionProxyV1.openBorrowPosition(
        fromAccountNumber,
        borrowAccountNumber,
        market1,
        wei1,
        defaultBalanceCheckFlag,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);

      await dolomiteMargin.borrowPositionProxyV1.transferBetweenAccounts(
        borrowAccountNumber,
        fromAccountNumber,
        market2,
        wei2,
        defaultBalanceCheckFlag,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, fromAccountNumber, market2, wei2.times(2));
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market2, wei2.times(-1));

      await dolomiteMargin.borrowPositionProxyV1.repayAllForBorrowPosition(
        fromAccountNumber,
        borrowAccountNumber,
        market2,
        defaultBalanceCheckFlag,
      );

      await expectBalances(owner1, fromAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, fromAccountNumber, market2, wei2);
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market2, INTEGERS.ZERO);
    });

    it('should work when BalanceCheckFlag is set to None and from account has debt after repaying', async () => {
      await dolomiteMargin.testing.setAccountBalance(owner1, fromAccountNumber, market1, weiBig1);
      await dolomiteMargin.testing.setAccountBalance(owner1, fromAccountNumber, market2, INTEGERS.ZERO);
      await dolomiteMargin.testing.setAccountBalance(owner1, borrowAccountNumber, market1, wei1);
      await dolomiteMargin.testing.setAccountBalance(owner1, borrowAccountNumber, market2, wei2.negated());

      await dolomiteMargin.borrowPositionProxyV1.repayAllForBorrowPosition(
        fromAccountNumber,
        borrowAccountNumber,
        market2,
        BalanceCheckFlag.None,
      );

      await expectBalances(owner1, fromAccountNumber, market1, weiBig1);
      await expectBalances(owner1, fromAccountNumber, market2, wei2.negated());
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market2, INTEGERS.ZERO);
    });

    it('should work when BalanceCheckFlag is set to To and from account has debt after repaying', async () => {
      await dolomiteMargin.testing.setAccountBalance(owner1, fromAccountNumber, market1, weiBig1);
      await dolomiteMargin.testing.setAccountBalance(owner1, fromAccountNumber, market2, INTEGERS.ZERO);
      await dolomiteMargin.testing.setAccountBalance(owner1, borrowAccountNumber, market1, wei1);
      await dolomiteMargin.testing.setAccountBalance(owner1, borrowAccountNumber, market2, wei2.negated());

      await dolomiteMargin.borrowPositionProxyV1.repayAllForBorrowPosition(
        fromAccountNumber,
        borrowAccountNumber,
        market2,
        BalanceCheckFlag.To,
      );

      await expectBalances(owner1, fromAccountNumber, market1, weiBig1);
      await expectBalances(owner1, fromAccountNumber, market2, wei2.negated());
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market2, INTEGERS.ZERO);
    });

    it('should fail when BalanceCheckFlag is set to From or Both and from account has debt after repaying', async () => {
      await dolomiteMargin.testing.setAccountBalance(owner1, fromAccountNumber, market1, weiBig1);
      await dolomiteMargin.testing.setAccountBalance(owner1, fromAccountNumber, market2, INTEGERS.ZERO);
      await dolomiteMargin.testing.setAccountBalance(owner1, borrowAccountNumber, market1, wei1);
      await dolomiteMargin.testing.setAccountBalance(owner1, borrowAccountNumber, market2, wei2.negated());

      await expectThrowInvalidBalance(
        dolomiteMargin.borrowPositionProxyV1.repayAllForBorrowPosition(
          fromAccountNumber,
          borrowAccountNumber,
          market2,
          BalanceCheckFlag.From,
        ),
        owner1,
        fromAccountNumber,
        market2
      );
      await expectThrowInvalidBalance(
        dolomiteMargin.borrowPositionProxyV1.repayAllForBorrowPosition(
          fromAccountNumber,
          borrowAccountNumber,
          market2,
          BalanceCheckFlag.Both,
        ),
        owner1,
        fromAccountNumber,
        market2
      );
    });
  });

  describe('#closeBorrowPosition', () => {
    it('success case when debt is repaid', async () => {
      await expectBalances(owner1, fromAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market1, INTEGERS.ZERO);

      await dolomiteMargin.borrowPositionProxyV1.openBorrowPosition(
        fromAccountNumber,
        borrowAccountNumber,
        market1,
        wei1,
        defaultBalanceCheckFlag,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);

      await dolomiteMargin.borrowPositionProxyV1.transferBetweenAccounts(
        borrowAccountNumber,
        fromAccountNumber,
        market2,
        wei2,
        defaultBalanceCheckFlag,
        { from: owner1 },
      );

      await expectBalances(owner1, fromAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, fromAccountNumber, market2, wei2.times(2));
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market2, wei2.times(-1));

      await dolomiteMargin.borrowPositionProxyV1.repayAllForBorrowPosition(
        fromAccountNumber,
        borrowAccountNumber,
        market2,
        defaultBalanceCheckFlag,
      );

      await expectBalances(owner1, fromAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, fromAccountNumber, market2, wei2);
      await expectBalances(owner1, borrowAccountNumber, market1, wei1);
      await expectBalances(owner1, borrowAccountNumber, market2, INTEGERS.ZERO);

      await dolomiteMargin.borrowPositionProxyV1.closeBorrowPosition(
        borrowAccountNumber,
        fromAccountNumber,
        [market1],
      );

      await expectBalances(owner1, fromAccountNumber, market1, wei1);
      await expectBalances(owner1, fromAccountNumber, market2, wei2);
      await expectBalances(owner1, borrowAccountNumber, market1, INTEGERS.ZERO);
      await expectBalances(owner1, borrowAccountNumber, market2, INTEGERS.ZERO);
    });
  });
});

// =============== Helper Functions

async function expectBalances(
  owner: address,
  accountNumber: Integer,
  market: Integer,
  amount: Integer,
): Promise<void> {
  const balance = await dolomiteMargin.getters.getAccountWei(owner, accountNumber, market);
  expect(balance).to.eql(amount);
}
