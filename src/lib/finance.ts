import {
  OVERALL_BUDGET_ID,
  type Account,
  type Asset,
  type Budget,
  type BudgetStatus,
  type Expense,
  type Goal,
  type GoalContribution,
  type Income,
  type Investment,
  type InvestmentTransaction,
  type Loan,
  type LoanPayment,
  type LoanStatus,
  type MonthlyPoint,
  type Transfer,
} from "@/types/domain";

/**
 * Pure, framework-agnostic finance calculations shared by the server (services)
 * and, where useful, the client. No side effects, no I/O.
 */

/** "YYYY-MM" bucket key for a date string. */
export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/** Sum a numeric field over a list. */
function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

/** Account a repayment moved through, falling back to the parent loan. */
export function resolveLoanPaymentAccountId(
  payment: LoanPayment,
  loanById: Map<string, Loan>,
): string | undefined {
  return payment.accountId ?? loanById.get(payment.loanId)?.accountId;
}

/** Receipts credited to / payments deducted from a specific account. */
export function sumLoanPaymentsForAccount(
  accountId: string,
  loans: Loan[],
  loanPayments: LoanPayment[],
): { receiptsIn: number; paymentsOut: number } {
  const loanById = new Map(loans.map((loan) => [loan.id, loan]));
  const forAccount = loanPayments.filter(
    (payment) => resolveLoanPaymentAccountId(payment, loanById) === accountId,
  );
  return {
    receiptsIn: sumBy(
      forAccount.filter((payment) => payment.direction === "receipt"),
      (payment) => payment.amount,
    ),
    paymentsOut: sumBy(
      forAccount.filter((payment) => payment.direction === "payment"),
      (payment) => payment.amount,
    ),
  };
}

/** Investment income credited to a specific account. */
export function sumInvestmentIncomeForAccount(
  accountId: string,
  investmentTransactions: InvestmentTransaction[],
): number {
  return sumBy(
    investmentTransactions.filter(
      (t) => t.direction === "income" && t.accountId === accountId,
    ),
    (t) => t.amount,
  );
}

/** Everything that can move money in or out of an account. */
export interface BalanceSources {
  expenses: Expense[];
  income: Income[];
  investments?: Investment[];
  assets?: Asset[];
  loans?: Loan[];
  loanPayments?: LoanPayment[];
  investmentTransactions?: InvestmentTransaction[];
  transfers?: Transfer[];
}

/** Money into / out of one account, split by source. */
export interface AccountFlows {
  inflow: number;
  outflow: number;
}

/**
 * Inflow and outflow for an account:
 *   in:  income, borrowed principal received, loan repayments received,
 *        investment income, asset sale proceeds, transfers in
 *   out: expenses, investment/asset purchases funded from it, principal lent
 *        out, loan repayments made, transfers out
 * Repayments use the payment's own account when set, otherwise the loan's.
 */
export function computeAccountFlows(
  accountId: string,
  sources: BalanceSources,
): AccountFlows {
  const {
    expenses,
    income,
    investments = [],
    assets = [],
    loans = [],
    loanPayments = [],
    investmentTransactions = [],
    transfers = [],
  } = sources;

  const accountLoans = loans.filter((l) => l.accountId === accountId);
  const { receiptsIn, paymentsOut } = sumLoanPaymentsForAccount(
    accountId,
    loans,
    loanPayments,
  );

  const inflow =
    sumBy(
      income.filter((i) => i.accountId === accountId),
      (i) => i.amount,
    ) +
    sumBy(
      accountLoans.filter((l) => l.type === "borrowed"),
      (l) => l.principal,
    ) +
    receiptsIn +
    sumInvestmentIncomeForAccount(accountId, investmentTransactions) +
    sumBy(
      assets.filter(
        (a) => a.status === "sold" && a.saleAccountId === accountId,
      ),
      (a) => a.saleValue ?? 0,
    ) +
    sumBy(
      transfers.filter((t) => t.toAccountId === accountId),
      (t) => t.amount,
    );

  const outflow =
    sumBy(
      expenses.filter((e) => e.accountId === accountId),
      (e) => e.amount,
    ) +
    sumBy(
      investments.filter((v) => v.accountId === accountId),
      (v) => v.amountInvested,
    ) +
    sumBy(
      assets.filter((a) => a.accountId === accountId),
      (a) => a.purchaseValue,
    ) +
    sumBy(
      accountLoans.filter((l) => l.type === "lent"),
      (l) => l.principal,
    ) +
    paymentsOut +
    sumBy(
      transfers.filter((t) => t.fromAccountId === accountId),
      (t) => t.amount,
    );

  return { inflow, outflow };
}

/** Current balance = opening balance + inflow − outflow. */
export function computeAccountBalance(
  account: Account,
  sources: BalanceSources,
): number {
  const { inflow, outflow } = computeAccountFlows(account.id, sources);
  return Number((account.openingBalance + inflow - outflow).toFixed(2));
}

/** Total paid so far against a loan (payments for borrowed, receipts for lent). */
export function computeLoanPaid(loan: Loan, payments: LoanPayment[]): number {
  const relevant = payments.filter((p) => p.loanId === loan.id);
  return sumBy(relevant, (p) => p.amount);
}

/** Outstanding balance including optional simple interest on the principal. */
export function computeLoanRemaining(
  loan: Loan,
  payments: LoanPayment[],
): number {
  const interest = loan.interestRate
    ? (loan.principal * loan.interestRate) / 100
    : 0;
  const remaining = loan.principal + interest - computeLoanPaid(loan, payments);
  return Math.max(0, Number(remaining.toFixed(2)));
}

/** Absolute gain/loss given a current value and its cost basis. */
export function computeGain(currentValue: number, basis: number): number {
  return Number((currentValue - basis).toFixed(2));
}

/** Gain expressed as a percentage of the cost basis. */
export function computeReturnPct(currentValue: number, basis: number): number {
  if (basis <= 0) return 0;
  return Number(((computeGain(currentValue, basis) / basis) * 100).toFixed(2));
}

/** Income (dividends, profit, sale proceeds) received from an investment. */
export function sumInvestmentIncome(
  investmentId: string,
  transactions: InvestmentTransaction[],
): number {
  return sumBy(
    transactions.filter(
      (t) => t.investmentId === investmentId && t.direction === "income",
    ),
    (t) => t.amount,
  );
}

/**
 * Total return on an investment: what it's worth now plus what it has paid
 * out, minus what went in. Counting payouts means selling (record the
 * proceeds as income, set the value to 0) shows the real profit or loss.
 */
export function computeInvestmentGain(
  investment: Investment,
  transactions: InvestmentTransaction[] = [],
): number {
  return computeGain(
    investment.currentValue + sumInvestmentIncome(investment.id, transactions),
    investment.amountInvested,
  );
}

/** Total return as a percentage of the amount invested. */
export function computeInvestmentReturnPct(
  investment: Investment,
  transactions: InvestmentTransaction[] = [],
): number {
  return computeReturnPct(
    investment.currentValue + sumInvestmentIncome(investment.id, transactions),
    investment.amountInvested,
  );
}

/**
 * What an asset is worth for gain purposes: the sale value once sold
 * (realized), otherwise the latest estimate (unrealized).
 */
export function assetValue(asset: Asset): number {
  return asset.status === "sold" ? (asset.saleValue ?? 0) : asset.currentValue;
}

/** Absolute gain/loss on an asset: value (sale or current) − purchase value. */
export function computeAssetGain(asset: Asset): number {
  return computeGain(assetValue(asset), asset.purchaseValue);
}

/** Asset gain expressed as a percentage of the purchase value. */
export function computeAssetReturnPct(asset: Asset): number {
  return computeReturnPct(assetValue(asset), asset.purchaseValue);
}

/** Current value of the assets still held; sold ones are no longer owned. */
export function sumOwnedAssetValue(assets: Asset[]): number {
  return sumBy(
    assets.filter((a) => a.status !== "sold"),
    (a) => a.currentValue,
  );
}

export interface AssetTotals {
  totalPurchase: number;
  /** Sum of `assetValue`: current value if held, sale value if sold. */
  totalValue: number;
  totalGain: number;
  returnPct: number;
}

/** Purchase, value and gain totals for a set of assets. */
export function summarizeAssets(assets: Asset[]): AssetTotals {
  const totalPurchase = sumBy(assets, (a) => a.purchaseValue);
  const totalValue = sumBy(assets, assetValue);
  return {
    totalPurchase: Number(totalPurchase.toFixed(2)),
    totalValue: Number(totalValue.toFixed(2)),
    totalGain: computeGain(totalValue, totalPurchase),
    returnPct: computeReturnPct(totalValue, totalPurchase),
  };
}

/** Build an income/expense series for the last `months` calendar months. */
export function buildMonthlySeries(
  expenses: Expense[],
  income: Income[],
  months: number,
  reference: Date = new Date(),
): MonthlyPoint[] {
  const buckets: MonthlyPoint[] = [];
  const byMonth = new Map<string, MonthlyPoint>();

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(
      reference.getFullYear(),
      reference.getMonth() - offset,
      1,
    );
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const point: MonthlyPoint = { month: key, income: 0, expense: 0 };
    byMonth.set(key, point);
    buckets.push(point);
  }

  for (const expense of expenses) {
    const point = byMonth.get(monthKey(expense.date));
    if (point) point.expense += expense.amount;
  }
  for (const entry of income) {
    const point = byMonth.get(monthKey(entry.date));
    if (point) point.income += entry.amount;
  }

  return buckets;
}

/**
 * Status shown to the user. A loan the user marked settled stays settled;
 * otherwise it settles itself once fully repaid and turns overdue once its
 * due date passes with money still owed.
 */
export function effectiveLoanStatus(
  loan: Loan,
  remaining: number,
  todayISO: string = new Date().toISOString().slice(0, 10),
): LoanStatus {
  if (loan.status === "settled") return "settled";
  if (remaining <= 0) return "settled";
  if (loan.dueDate && loan.dueDate < todayISO) return "overdue";
  return "active";
}

/** Outstanding borrowed (liabilities) and lent (receivables) totals. */
export function computeLoanTotals(
  loans: Loan[],
  payments: LoanPayment[],
): { outstandingBorrowed: number; outstandingLent: number } {
  let outstandingBorrowed = 0;
  let outstandingLent = 0;
  for (const loan of loans) {
    const remaining = computeLoanRemaining(loan, payments);
    if (effectiveLoanStatus(loan, remaining) === "settled") continue;
    if (loan.type === "borrowed") outstandingBorrowed += remaining;
    else outstandingLent += remaining;
  }
  return {
    outstandingBorrowed: Number(outstandingBorrowed.toFixed(2)),
    outstandingLent: Number(outstandingLent.toFixed(2)),
  };
}

/**
 * Net worth = what you have minus what you owe:
 *   cash + investments + assets + money lent out − money still owed.
 * Borrowed principal already sits in cash, so the debt must be subtracted;
 * lent principal already left cash, so the receivable must be added back.
 */
export function computeNetWorth(parts: {
  cash: number;
  investments: number;
  assets: number;
  receivables: number;
  liabilities: number;
}): number {
  return Number(
    (
      parts.cash +
      parts.investments +
      parts.assets +
      parts.receivables -
      parts.liabilities
    ).toFixed(2),
  );
}

/** Usage of each budget for the given "YYYY-MM" month. */
export function computeBudgetStatuses(
  budgets: Budget[],
  expenses: Expense[],
  month: string,
): BudgetStatus[] {
  const monthExpenses = expenses.filter((e) => monthKey(e.date) === month);
  const byCategory = new Map<string, number>();
  for (const expense of monthExpenses) {
    byCategory.set(
      expense.categoryId,
      (byCategory.get(expense.categoryId) ?? 0) + expense.amount,
    );
  }
  const total = sumBy(monthExpenses, (e) => e.amount);

  return budgets.map((budget) => {
    const spent = Number(
      (budget.categoryId === OVERALL_BUDGET_ID
        ? total
        : (byCategory.get(budget.categoryId) ?? 0)
      ).toFixed(2),
    );
    const ratio = budget.amount > 0 ? spent / budget.amount : 0;
    return {
      ...budget,
      month,
      spent,
      remaining: Number((budget.amount - spent).toFixed(2)),
      ratio,
      level: ratio >= 1 ? "exceeded" : ratio >= 0.8 ? "warning" : "ok",
    };
  });
}

/** Whole months from `fromISO` until `toISO` (at least 1 if any time left). */
export function monthsUntil(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO.slice(0, 10)}T00:00:00Z`);
  const to = new Date(`${toISO.slice(0, 10)}T00:00:00Z`);
  if (to <= from) return 0;
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) +
    (to.getUTCDate() >= from.getUTCDate() ? 0 : -1);
  return Math.max(1, months);
}

/**
 * Saved amount and the monthly contribution still needed for a goal. Linked
 * goals track the account's balance; others sum their contributions.
 */
export function computeGoalProgress(
  goal: Goal,
  contributions: GoalContribution[],
  accountBalance: number | undefined,
  todayISO: string = new Date().toISOString().slice(0, 10),
): { savedAmount: number; monthlyNeeded?: number } {
  const savedAmount = Number(
    (goal.accountId
      ? Math.max(0, accountBalance ?? 0)
      : sumBy(
          contributions.filter((c) => c.goalId === goal.id),
          (c) => c.amount,
        )
    ).toFixed(2),
  );
  const left = Math.max(0, goal.targetAmount - savedAmount);
  if (!goal.targetDate || left === 0) {
    return { savedAmount, monthlyNeeded: left === 0 ? 0 : undefined };
  }
  const months = monthsUntil(todayISO, goal.targetDate);
  return {
    savedAmount,
    monthlyNeeded: Number((months > 0 ? left / months : left).toFixed(2)),
  };
}
