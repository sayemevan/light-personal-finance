import type {
  Account,
  Asset,
  Expense,
  Income,
  Investment,
  Loan,
  LoanPayment,
  MonthlyPoint,
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

/**
 * Current balance = opening balance + income in − expense out − money spent
 * buying investments/assets that were funded from this account, plus the effect
 * of loans that moved money through this account:
 *   • lending money out reduces the balance (and repayments received add it back)
 *   • borrowing money in raises the balance (and repayments made reduce it)
 * Loan repayments are assumed to flow through the loan's own account.
 */
export function computeAccountBalance(
  account: Account,
  expenses: Expense[],
  income: Income[],
  investments: Investment[] = [],
  assets: Asset[] = [],
  loans: Loan[] = [],
  loanPayments: LoanPayment[] = [],
): number {
  const inflow = sumBy(
    income.filter((i) => i.accountId === account.id),
    (i) => i.amount,
  );
  const outflow = sumBy(
    expenses.filter((e) => e.accountId === account.id),
    (e) => e.amount,
  );
  const investmentOutflow = sumBy(
    investments.filter((v) => v.accountId === account.id),
    (v) => v.amountInvested,
  );
  const assetOutflow = sumBy(
    assets.filter((a) => a.accountId === account.id),
    (a) => a.purchaseValue,
  );

  const accountLoans = loans.filter((l) => l.accountId === account.id);
  const loanIds = new Set(accountLoans.map((l) => l.id));
  const accountPayments = loanPayments.filter((p) => loanIds.has(p.loanId));

  // Principal that left the account when lending, or entered when borrowing.
  const lentOut = sumBy(
    accountLoans.filter((l) => l.type === "lent"),
    (l) => l.principal,
  );
  const borrowedIn = sumBy(
    accountLoans.filter((l) => l.type === "borrowed"),
    (l) => l.principal,
  );
  // Repayments received on lent loans return money; repayments made on borrowed
  // loans send money out.
  const receiptsIn = sumBy(
    accountPayments.filter((p) => p.direction === "receipt"),
    (p) => p.amount,
  );
  const paymentsOut = sumBy(
    accountPayments.filter((p) => p.direction === "payment"),
    (p) => p.amount,
  );

  return (
    account.openingBalance +
    inflow +
    borrowedIn +
    receiptsIn -
    outflow -
    investmentOutflow -
    assetOutflow -
    lentOut -
    paymentsOut
  );
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

/** Absolute gain/loss on an investment: current value − amount invested. */
export function computeInvestmentGain(investment: Investment): number {
  return computeGain(investment.currentValue, investment.amountInvested);
}

/** Investment gain expressed as a percentage of the amount invested. */
export function computeInvestmentReturnPct(investment: Investment): number {
  return computeReturnPct(investment.currentValue, investment.amountInvested);
}

/** Absolute gain/loss on an asset: current value − purchase value. */
export function computeAssetGain(asset: Asset): number {
  return computeGain(asset.currentValue, asset.purchaseValue);
}

/** Asset gain expressed as a percentage of the purchase value. */
export function computeAssetReturnPct(asset: Asset): number {
  return computeReturnPct(asset.currentValue, asset.purchaseValue);
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
