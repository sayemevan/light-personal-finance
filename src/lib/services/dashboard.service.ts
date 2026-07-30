import "server-only";
import {
  accountsRepo,
  expensesRepo,
  incomeRepo,
  loansRepo,
  loanPaymentsRepo,
} from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import {
  buildMonthlySeries,
  computeAccountBalance,
  computeLoanRemaining,
  monthKey,
} from "@/lib/finance";
import type { DashboardSummary, Transaction } from "@/types/domain";

const RECENT_LIMIT = 8;
const UPCOMING_LIMIT = 5;

/** Build the full dashboard payload from the underlying tabs. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const spreadsheetId = await getSpreadsheetId();
  const [accounts, expenses, income, loans, payments] = await Promise.all([
    accountsRepo.list(spreadsheetId),
    expensesRepo.list(spreadsheetId),
    incomeRepo.list(spreadsheetId),
    loansRepo.list(spreadsheetId),
    loanPaymentsRepo.list(spreadsheetId),
  ]);

  const currentMonth = monthKey(new Date().toISOString());
  const todayISO = new Date().toISOString().slice(0, 10);

  const totalBalance = accounts.reduce(
    (sum, account) => sum + computeAccountBalance(account, expenses, income),
    0,
  );

  const monthExpense = expenses
    .filter((e) => monthKey(e.date) === currentMonth)
    .reduce((sum, e) => sum + e.amount, 0);

  const monthIncome = income
    .filter((i) => monthKey(i.date) === currentMonth)
    .reduce((sum, i) => sum + i.amount, 0);

  const outstandingLoans = loans
    .filter((l) => l.type === "borrowed" && l.status === "active")
    .reduce((sum, l) => sum + computeLoanRemaining(l, payments), 0);

  const moneyLent = loans
    .filter((l) => l.type === "lent" && l.status === "active")
    .reduce((sum, l) => sum + computeLoanRemaining(l, payments), 0);

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

  const upcomingDuePayments = loans
    .filter((l) => l.status === "active" && l.dueDate && l.dueDate >= todayISO)
    .map((l) => ({ ...l, remainingBalance: computeLoanRemaining(l, payments) }))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, UPCOMING_LIMIT);

  return {
    totalBalance,
    monthExpense,
    monthIncome,
    savings: monthIncome - monthExpense,
    outstandingLoans,
    moneyLent,
    recentTransactions,
    upcomingDuePayments,
    monthlySummary: buildMonthlySeries(expenses, income, 6),
  };
}
