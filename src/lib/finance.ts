import type {
  Account,
  Expense,
  Income,
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

/** Current balance = opening balance + income in − expense out. */
export function computeAccountBalance(
  account: Account,
  expenses: Expense[],
  income: Income[],
): number {
  const inflow = sumBy(
    income.filter((i) => i.accountId === account.id),
    (i) => i.amount,
  );
  const outflow = sumBy(
    expenses.filter((e) => e.accountId === account.id),
    (e) => e.amount,
  );
  return account.openingBalance + inflow - outflow;
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
