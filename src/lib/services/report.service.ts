import "server-only";
import {
  assetsRepo,
  categoriesRepo,
} from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import {
  currentCalendarYear,
  getExpensesForYear,
  getIncomeForYear,
  isLiveYear,
} from "@/lib/services/history.service";
import {
  buildMonthlySeries,
  computeAccountBalance,
  computeAccountFlows,
  computeLoanTotals,
  sumInvestmentIncome,
  summarizeAssets,
} from "@/lib/finance";
import { loadLedger } from "@/lib/services/ledger.service";
import {
  ASSET_CATEGORY_LABELS,
  INVESTMENT_TYPE_LABELS,
} from "@/lib/labels";
import type {
  AssetCategory,
  Category,
  Expense,
  Income,
  InvestmentType,
  MonthlyPoint,
} from "@/types/domain";
import type {
  AccountSummaryRow,
  AssetSummary,
  AssetSummaryRow,
  CashFlowItem,
  CashFlowReport,
  CategoryComparisonRow,
  CategorySummaryRow,
  MerchantRow,
  OverviewReport,
  PeriodTotals,
  TagReport,
  TagSummaryRow,
  InvestmentSummary,
  InvestmentSummaryRow,
  LoanSummary,
} from "@/types/reports";

/** Round to 2 decimals, guarding against float noise. */
function round2(value: number): number {
  return Number(value.toFixed(2));
}

/** Shared 12-month income/expense series. */
async function monthlySeries(
  year: string,
  months = 12,
): Promise<MonthlyPoint[]> {
  const [expenses, income] = await Promise.all([
    getExpensesForYear(year),
    getIncomeForYear(year),
  ]);
  const reference = isLiveYear(year)
    ? new Date()
    : new Date(Number(year), 11, 1);
  return buildMonthlySeries(expenses, income, months, reference);
}

export async function getMonthlyExpense(year: string): Promise<MonthlyPoint[]> {
  return monthlySeries(year);
}

export async function getMonthlyIncome(year: string): Promise<MonthlyPoint[]> {
  return monthlySeries(year);
}

export async function getCategorySummary(
  year: string,
): Promise<CategorySummaryRow[]> {
  const spreadsheetId = await getSpreadsheetId();
  const [categories, expenses, income] = await Promise.all([
    categoriesRepo.list(spreadsheetId),
    getExpensesForYear(year),
    getIncomeForYear(year),
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
  const ledger = await loadLedger();
  return ledger.accounts.map((account) => {
    const { inflow, outflow } = computeAccountFlows(account.id, ledger);
    return {
      accountId: account.id,
      name: account.name,
      inflow,
      outflow,
      balance: computeAccountBalance(account, ledger),
    };
  });
}

export async function getLoanSummary(): Promise<LoanSummary> {
  const { loans, loanPayments } = await loadLedger();
  const { outstandingBorrowed, outstandingLent } = computeLoanTotals(
    loans,
    loanPayments,
  );
  return {
    totalBorrowed: loans
      .filter((l) => l.type === "borrowed")
      .reduce((sum, l) => sum + l.principal, 0),
    totalLent: loans
      .filter((l) => l.type === "lent")
      .reduce((sum, l) => sum + l.principal, 0),
    outstandingBorrowed,
    outstandingLent,
  };
}

export async function getInvestmentSummary(): Promise<InvestmentSummary> {
  const { investments, investmentTransactions } = await loadLedger();

  const byType = new Map<InvestmentType, InvestmentSummaryRow>();
  let totalInvested = 0;
  let currentValue = 0;
  let totalPayouts = 0;

  for (const investment of investments) {
    // Gains count payouts (dividends, sale proceeds) as well as value change.
    const payouts = sumInvestmentIncome(investment.id, investmentTransactions);
    totalInvested += investment.amountInvested;
    currentValue += investment.currentValue;
    totalPayouts += payouts;

    const row = byType.get(investment.type) ?? {
      key: investment.type,
      label: INVESTMENT_TYPE_LABELS[investment.type],
      invested: 0,
      currentValue: 0,
      gain: 0,
    };
    row.invested += investment.amountInvested;
    row.currentValue += investment.currentValue;
    row.gain = round2(
      row.gain + investment.currentValue + payouts - investment.amountInvested,
    );
    byType.set(investment.type, row);
  }

  const totalGain = round2(currentValue + totalPayouts - totalInvested);
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
  // Holdings are what's still owned; sold assets only contribute their
  // realized gain.
  const owned = assets.filter((asset) => asset.status !== "sold");
  const sold = assets.filter((asset) => asset.status === "sold");

  const byCategory = new Map<AssetCategory, AssetSummaryRow>();
  for (const asset of owned) {
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

  const totals = summarizeAssets(owned);
  return {
    totalPurchase: totals.totalPurchase,
    currentValue: totals.totalValue,
    totalGain: totals.totalGain,
    returnPct: totals.returnPct,
    realizedGain: summarizeAssets(sold).totalGain,
    soldCount: sold.length,
    byCategory: [...byCategory.values()]
      .map((row) => ({ ...row, purchaseValue: round2(row.purchaseValue), currentValue: round2(row.currentValue) }))
      .sort((a, b) => b.currentValue - a.currentValue),
  };
}

// ---------------------------------------------------------------------------
// Overview, cash flow and tag reports
// ---------------------------------------------------------------------------

/** "live" means the current calendar year for date-bounded reports. */
function resolveYear(year: string): string {
  return year === "live" ? currentCalendarYear() : year;
}

function inPeriod<T extends { date: string }>(rows: T[], prefix: string): T[] {
  return rows.filter((row) => row.date.startsWith(prefix));
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function sumAmounts(rows: { amount: number }[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

function periodTotals(expenses: Expense[], income: Income[]): PeriodTotals {
  const spent = round2(sumAmounts(expenses));
  const earned = round2(sumAmounts(income));
  return { spent, income: earned, net: round2(earned - spent) };
}

function categoryNames(categories: Category[]): Map<string, string> {
  return new Map(categories.map((category) => [category.id, category.name]));
}

const UNCATEGORISED = "Uncategorised";

/** Normalise a merchant for grouping: trimmed, single-spaced, lowercase. */
export function merchantKey(merchant: string | undefined): string {
  return (merchant ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Normalise a tag: trimmed, no leading "#", lowercase. */
export function normaliseTag(tag: string): string {
  return tag.trim().replace(/^#+/, "").trim().toLowerCase();
}

/** Group expenses by merchant (case-insensitive), most spent first. */
export function summariseMerchants(
  expenses: Expense[],
  limit = 10,
): MerchantRow[] {
  const groups = new Map<
    string,
    { total: number; count: number; spellings: Map<string, number> }
  >();
  for (const expense of expenses) {
    const key = merchantKey(expense.merchant);
    if (!key) continue;
    const group = groups.get(key) ?? {
      total: 0,
      count: 0,
      spellings: new Map<string, number>(),
    };
    group.total += expense.amount;
    group.count += 1;
    const spelling = (expense.merchant ?? "").trim().replace(/\s+/g, " ");
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      // Show the spelling the user typed most often.
      name:
        [...group.spellings.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        "",
      total: round2(group.total),
      count: group.count,
    }))
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .slice(0, limit);
}

function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** This month vs last month, category comparison and top merchants. */
export async function getOverview(
  yearParam: string,
  month: number,
): Promise<OverviewReport> {
  const year = resolveYear(yearParam);
  const y = Number(year);
  const current = monthPrefix(y, month);
  const previous = month === 1 ? monthPrefix(y - 1, 12) : monthPrefix(y, month - 1);
  const needsPrevYear = month === 1;

  const [ledger, expenses, income, prevExpenses, prevIncome] = await Promise.all([
    loadLedger(),
    getExpensesForYear(year),
    getIncomeForYear(year),
    needsPrevYear ? getExpensesForYear(String(y - 1)) : Promise.resolve([]),
    needsPrevYear ? getIncomeForYear(String(y - 1)) : Promise.resolve([]),
  ]);
  const allExpenses = dedupeById([...expenses, ...prevExpenses]);
  const allIncome = dedupeById([...income, ...prevIncome]);

  const curExpenses = inPeriod(allExpenses, `${current}-`);
  const prevExpensesInMonth = inPeriod(allExpenses, `${previous}-`);
  const names = categoryNames(ledger.categories);

  const byCategory = new Map<string, { current: number; previous: number }>();
  for (const [rows, field] of [
    [curExpenses, "current"],
    [prevExpensesInMonth, "previous"],
  ] as const) {
    for (const expense of rows) {
      const entry = byCategory.get(expense.categoryId) ?? {
        current: 0,
        previous: 0,
      };
      entry[field] += expense.amount;
      byCategory.set(expense.categoryId, entry);
    }
  }
  const categories: CategoryComparisonRow[] = [...byCategory.entries()]
    .map(([categoryId, entry]) => ({
      categoryId,
      name: names.get(categoryId) ?? UNCATEGORISED,
      current: round2(entry.current),
      previous: round2(entry.previous),
      change: round2(entry.current - entry.previous),
    }))
    .sort((a, b) => b.current - a.current || b.previous - a.previous);

  return {
    year,
    month: current,
    previousMonth: previous,
    current: periodTotals(curExpenses, inPeriod(allIncome, `${current}-`)),
    previous: periodTotals(
      prevExpensesInMonth,
      inPeriod(allIncome, `${previous}-`),
    ),
    categories,
    topMerchants: summariseMerchants(inPeriod(expenses, `${year}-`)),
  };
}

/** Fold everything past the top `limit` items into a single "Other". */
function topWithOther(
  totals: Map<string, number>,
  limit: number,
): CashFlowItem[] {
  const sorted = [...totals.entries()]
    .filter(([, total]) => total > 0)
    .map(([name, total]) => ({ name, total: round2(total) }))
    .sort((a, b) => b.total - a.total);
  if (sorted.length <= limit + 1) return sorted;
  const rest = sorted.slice(limit);
  return [
    ...sorted.slice(0, limit),
    {
      name: "Other",
      total: round2(rest.reduce((sum, row) => sum + row.total, 0)),
    },
  ];
}

function totalsByCategoryName(
  rows: { categoryId: string; amount: number }[],
  names: Map<string, string>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const name = names.get(row.categoryId) ?? UNCATEGORISED;
    totals.set(name, (totals.get(name) ?? 0) + row.amount);
  }
  return totals;
}

/**
 * Where the year's money came from and went. Transfers between the user's own
 * accounts live in their own tab and are never part of income or expense.
 */
export async function getCashFlow(yearParam: string): Promise<CashFlowReport> {
  const year = resolveYear(yearParam);
  const [ledger, expenses, income] = await Promise.all([
    loadLedger(),
    getExpensesForYear(year),
    getIncomeForYear(year),
  ]);
  const names = categoryNames(ledger.categories);
  const yearExpenses = inPeriod(expenses, `${year}-`);
  const yearIncome = inPeriod(income, `${year}-`);
  const totalIncome = round2(sumAmounts(yearIncome));
  const totalExpense = round2(sumAmounts(yearExpenses));

  return {
    year,
    totalIncome,
    totalExpense,
    income: topWithOther(totalsByCategoryName(yearIncome, names), 6),
    expense: topWithOther(totalsByCategoryName(yearExpenses, names), 8),
    saved: round2(Math.max(0, totalIncome - totalExpense)),
    fromSavings: round2(Math.max(0, totalExpense - totalIncome)),
  };
}

function summariseTags(
  rows: (Expense | Income)[],
  names: Map<string, string>,
): TagSummaryRow[] {
  const groups = new Map<string, TagSummaryRow>();
  for (const row of rows) {
    const tags = new Set((row.tags ?? []).map(normaliseTag).filter(Boolean));
    for (const tag of tags) {
      const group = groups.get(tag) ?? {
        tag,
        total: 0,
        count: 0,
        transactions: [],
      };
      group.total += row.amount;
      group.count += 1;
      group.transactions.push({
        id: row.id,
        date: row.date,
        categoryName: names.get(row.categoryId) ?? UNCATEGORISED,
        amount: row.amount,
        description:
          ("merchant" in row && row.merchant ? row.merchant : row.notes) ||
          undefined,
      });
      groups.set(tag, group);
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      total: round2(group.total),
      transactions: group.transactions.sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }))
    .sort((a, b) => b.total - a.total);
}

/** Totals per tag for the year, expense and income separately. */
export async function getTagReport(yearParam: string): Promise<TagReport> {
  const year = resolveYear(yearParam);
  const [ledger, expenses, income] = await Promise.all([
    loadLedger(),
    getExpensesForYear(year),
    getIncomeForYear(year),
  ]);
  const names = categoryNames(ledger.categories);
  return {
    year,
    expense: summariseTags(inPeriod(expenses, `${year}-`), names),
    income: summariseTags(inPeriod(income, `${year}-`), names),
  };
}
