import "server-only";
import { loadLedger } from "@/lib/services/ledger.service";
import {
  buildMonthlySeries,
  computeAccountBalance,
  computeLoanRemaining,
  computeLoanTotals,
  computeNetWorth,
  effectiveLoanStatus,
  monthKey,
} from "@/lib/finance";
import type { DashboardSummary, Transaction } from "@/types/domain";

const RECENT_LIMIT = 8;
const UPCOMING_LIMIT = 5;

/** Build the full dashboard payload from the underlying tabs. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const ledger = await loadLedger();
  const { accounts, expenses, income, loans, loanPayments, investments, assets } =
    ledger;

  const currentMonth = monthKey(new Date().toISOString());
  const todayISO = new Date().toISOString().slice(0, 10);

  const totalBalance = Number(
    accounts
      .reduce((sum, account) => sum + computeAccountBalance(account, ledger), 0)
      .toFixed(2),
  );

  const investmentValue = investments.reduce(
    (sum, investment) => sum + investment.currentValue,
    0,
  );

  const assetValue = assets.reduce(
    (sum, asset) => sum + asset.currentValue,
    0,
  );

  // Overdue loans are still owed, so count every loan that isn't settled.
  const { outstandingBorrowed, outstandingLent } = computeLoanTotals(
    loans,
    loanPayments,
  );

  const netWorth = computeNetWorth({
    cash: totalBalance,
    investments: investmentValue,
    assets: assetValue,
    receivables: outstandingLent,
    liabilities: outstandingBorrowed,
  });

  const monthExpense = expenses
    .filter((e) => monthKey(e.date) === currentMonth)
    .reduce((sum, e) => sum + e.amount, 0);

  const monthIncome = income
    .filter((i) => monthKey(i.date) === currentMonth)
    .reduce((sum, i) => sum + i.amount, 0);

  const recentTransactions: Transaction[] = [
    ...expenses.map<Transaction>((e) => ({
      id: e.id,
      kind: "expense",
      date: e.date,
      amount: e.amount,
      categoryId: e.categoryId,
      accountId: e.accountId,
      description: e.merchant ?? e.notes,
    })),
    ...income.map<Transaction>((i) => ({
      id: i.id,
      kind: "income",
      date: i.date,
      amount: i.amount,
      categoryId: i.categoryId,
      accountId: i.accountId,
      description: i.notes,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_LIMIT);

  // Overdue first (most urgent), then the soonest upcoming due dates.
  const upcomingDuePayments = loans
    .filter((l) => l.dueDate)
    .map((l) => {
      const remainingBalance = computeLoanRemaining(l, loanPayments);
      return {
        ...l,
        remainingBalance,
        status: effectiveLoanStatus(l, remainingBalance, todayISO),
      };
    })
    .filter((l) => l.status !== "settled")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, UPCOMING_LIMIT);

  return {
    totalBalance,
    monthExpense,
    monthIncome,
    savings: monthIncome - monthExpense,
    outstandingLoans: outstandingBorrowed,
    moneyLent: outstandingLent,
    recentTransactions,
    upcomingDuePayments,
    monthlySummary: buildMonthlySeries(expenses, income, 6),
    investmentValue,
    assetValue,
    netWorth,
  };
}
