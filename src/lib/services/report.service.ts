import "server-only";
import {
  accountsRepo,
  assetsRepo,
  categoriesRepo,
  expensesRepo,
  incomeRepo,
  investmentsRepo,
  loansRepo,
  loanPaymentsRepo,
} from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import {
  buildMonthlySeries,
  computeAccountBalance,
  computeLoanRemaining,
} from "@/lib/finance";
import {
  ASSET_CATEGORY_LABELS,
  INVESTMENT_TYPE_LABELS,
} from "@/lib/labels";
import type { AssetCategory, InvestmentType, MonthlyPoint } from "@/types/domain";
import type {
  AccountSummaryRow,
  AssetSummary,
  AssetSummaryRow,
  CategorySummaryRow,
  InvestmentSummary,
  InvestmentSummaryRow,
  LoanSummary,
} from "@/types/reports";

/** Round to 2 decimals, guarding against float noise. */
function round2(value: number): number {
  return Number(value.toFixed(2));
}

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
  const [accounts, expenses, income, investments, assets, loans, payments] =
    await Promise.all([
      accountsRepo.list(spreadsheetId),
      expensesRepo.list(spreadsheetId),
      incomeRepo.list(spreadsheetId),
      investmentsRepo.list(spreadsheetId),
      assetsRepo.list(spreadsheetId),
      loansRepo.list(spreadsheetId),
      loanPaymentsRepo.list(spreadsheetId),
    ]);

  return accounts.map((account) => {
    const accountLoans = loans.filter((l) => l.accountId === account.id);
    const loanIds = new Set(accountLoans.map((l) => l.id));
    const accountPayments = payments.filter((p) => loanIds.has(p.loanId));

    // Inflow includes income, borrowed principal received, and repayments
    // received on money lent out.
    const inflow =
      income
        .filter((i) => i.accountId === account.id)
        .reduce((sum, i) => sum + i.amount, 0) +
      accountLoans
        .filter((l) => l.type === "borrowed")
        .reduce((sum, l) => sum + l.principal, 0) +
      accountPayments
        .filter((p) => p.direction === "receipt")
        .reduce((sum, p) => sum + p.amount, 0);
    // Outflow includes ordinary expenses, money spent buying investments/assets
    // funded from this account, principal lent out, and repayments made on money
    // borrowed.
    const outflow =
      expenses
        .filter((e) => e.accountId === account.id)
        .reduce((sum, e) => sum + e.amount, 0) +
      investments
        .filter((v) => v.accountId === account.id)
        .reduce((sum, v) => sum + v.amountInvested, 0) +
      assets
        .filter((a) => a.accountId === account.id)
        .reduce((sum, a) => sum + a.purchaseValue, 0) +
      accountLoans
        .filter((l) => l.type === "lent")
        .reduce((sum, l) => sum + l.principal, 0) +
      accountPayments
        .filter((p) => p.direction === "payment")
        .reduce((sum, p) => sum + p.amount, 0);
    return {
      accountId: account.id,
      name: account.name,
      inflow,
      outflow,
      balance: computeAccountBalance(
        account,
        expenses,
        income,
        investments,
        assets,
        loans,
        payments,
      ),
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

export async function getInvestmentSummary(): Promise<InvestmentSummary> {
  const spreadsheetId = await getSpreadsheetId();
  const investments = await investmentsRepo.list(spreadsheetId);

  const byType = new Map<InvestmentType, InvestmentSummaryRow>();
  let totalInvested = 0;
  let currentValue = 0;

  for (const investment of investments) {
    totalInvested += investment.amountInvested;
    currentValue += investment.currentValue;

    const row = byType.get(investment.type) ?? {
      key: investment.type,
      label: INVESTMENT_TYPE_LABELS[investment.type],
      invested: 0,
      currentValue: 0,
      gain: 0,
    };
    row.invested += investment.amountInvested;
    row.currentValue += investment.currentValue;
    row.gain = round2(row.currentValue - row.invested);
    byType.set(investment.type, row);
  }

  const totalGain = round2(currentValue - totalInvested);
  return {
    totalInvested: round2(totalInvested),
    currentValue: round2(currentValue),
    totalGain,
    returnPct: totalInvested > 0 ? round2((totalGain / totalInvested) * 100) : 0,
    byType: [...byType.values()]
      .map((row) => ({ ...row, invested: round2(row.invested), currentValue: round2(row.currentValue) }))
      .sort((a, b) => b.currentValue - a.currentValue),
  };
}

export async function getAssetSummary(): Promise<AssetSummary> {
  const spreadsheetId = await getSpreadsheetId();
  const assets = await assetsRepo.list(spreadsheetId);

  const byCategory = new Map<AssetCategory, AssetSummaryRow>();
  let totalPurchase = 0;
  let currentValue = 0;

  for (const asset of assets) {
    totalPurchase += asset.purchaseValue;
    currentValue += asset.currentValue;

    const row = byCategory.get(asset.category) ?? {
      key: asset.category,
      label: ASSET_CATEGORY_LABELS[asset.category],
      purchaseValue: 0,
      currentValue: 0,
      gain: 0,
    };
    row.purchaseValue += asset.purchaseValue;
    row.currentValue += asset.currentValue;
    row.gain = round2(row.currentValue - row.purchaseValue);
    byCategory.set(asset.category, row);
  }

  const totalGain = round2(currentValue - totalPurchase);
  return {
    totalPurchase: round2(totalPurchase),
    currentValue: round2(currentValue),
    totalGain,
    returnPct: totalPurchase > 0 ? round2((totalGain / totalPurchase) * 100) : 0,
    byCategory: [...byCategory.values()]
      .map((row) => ({ ...row, purchaseValue: round2(row.purchaseValue), currentValue: round2(row.currentValue) }))
      .sort((a, b) => b.currentValue - a.currentValue),
  };
}
