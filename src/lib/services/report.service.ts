import "server-only";
import {
  accountsRepo,
  categoriesRepo,
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
} from "@/lib/finance";
import type { MonthlyPoint } from "@/types/domain";
import type {
  AccountSummaryRow,
  CategorySummaryRow,
  LoanSummary,
} from "@/types/reports";

/** Shared 12-month income/expense series. */
async function monthlySeries(months = 12): Promise<MonthlyPoint[]> {
  const spreadsheetId = await getSpreadsheetId();
  const [expenses, income] = await Promise.all([
    expensesRepo.list(spreadsheetId),
    incomeRepo.list(spreadsheetId),
  ]);
  return buildMonthlySeries(expenses, income, months);
}

export async function getMonthlyExpense(): Promise<MonthlyPoint[]> {
  return monthlySeries();
}

export async function getMonthlyIncome(): Promise<MonthlyPoint[]> {
  return monthlySeries();
}

export async function getCategorySummary(): Promise<CategorySummaryRow[]> {
  const spreadsheetId = await getSpreadsheetId();
  const [categories, expenses, income] = await Promise.all([
    categoriesRepo.list(spreadsheetId),
    expensesRepo.list(spreadsheetId),
    incomeRepo.list(spreadsheetId),
  ]);

  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(
      expense.categoryId,
      (totals.get(expense.categoryId) ?? 0) + expense.amount,
    );
  }
  for (const entry of income) {
    totals.set(
      entry.categoryId,
      (totals.get(entry.categoryId) ?? 0) + entry.amount,
    );
  }

  return categories
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      kind: category.kind,
      total: totals.get(category.id) ?? 0,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

export async function getAccountSummary(): Promise<AccountSummaryRow[]> {
  const spreadsheetId = await getSpreadsheetId();
  const [accounts, expenses, income] = await Promise.all([
    accountsRepo.list(spreadsheetId),
    expensesRepo.list(spreadsheetId),
    incomeRepo.list(spreadsheetId),
  ]);

  return accounts.map((account) => {
    const inflow = income
      .filter((i) => i.accountId === account.id)
      .reduce((sum, i) => sum + i.amount, 0);
    const outflow = expenses
      .filter((e) => e.accountId === account.id)
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      accountId: account.id,
      name: account.name,
      inflow,
      outflow,
      balance: computeAccountBalance(account, expenses, income),
    };
  });
}

export async function getLoanSummary(): Promise<LoanSummary> {
  const spreadsheetId = await getSpreadsheetId();
  const [loans, payments] = await Promise.all([
    loansRepo.list(spreadsheetId),
    loanPaymentsRepo.list(spreadsheetId),
  ]);

  const summary: LoanSummary = {
    totalBorrowed: 0,
    totalLent: 0,
    outstandingBorrowed: 0,
    outstandingLent: 0,
  };

  for (const loan of loans) {
    const remaining = computeLoanRemaining(loan, payments);
    if (loan.type === "borrowed") {
      summary.totalBorrowed += loan.principal;
      summary.outstandingBorrowed += remaining;
    } else {
      summary.totalLent += loan.principal;
      summary.outstandingLent += remaining;
    }
  }

  return summary;
}
