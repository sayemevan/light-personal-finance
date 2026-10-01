import type { CategoryKind } from "@/types/domain";

export interface CategorySummaryRow {
  categoryId: string;
  name: string;
  kind: CategoryKind;
  total: number;
}

export interface AccountSummaryRow {
  accountId: string;
  name: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export interface LoanSummary {
  totalBorrowed: number;
  totalLent: number;
  outstandingBorrowed: number;
  outstandingLent: number;
}

export interface InvestmentSummaryRow {
  key: string;
  label: string;
  invested: number;
  currentValue: number;
  gain: number;
}

export interface InvestmentSummary {
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  returnPct: number;
  byType: InvestmentSummaryRow[];
}

export interface AssetSummaryRow {
  key: string;
  label: string;
  purchaseValue: number;
  currentValue: number;
  gain: number;
}

export interface AssetSummary {
  totalPurchase: number;
  currentValue: number;
  totalGain: number;
  returnPct: number;
  /** Sale value − purchase value, summed over sold assets. */
  realizedGain: number;
  soldCount: number;
  byCategory: AssetSummaryRow[];
}

/** Spent / income / net for one calendar month. */
export interface PeriodTotals {
  spent: number;
  income: number;
  net: number;
}

export interface CategoryComparisonRow {
  categoryId: string;
  name: string;
  current: number;
  previous: number;
  /** current − previous */
  change: number;
}

export interface MerchantRow {
  name: string;
  total: number;
  count: number;
}

/** Month-over-month snapshot for the Overview tab. */
export interface OverviewReport {
  year: string;
  /** "YYYY-MM" of the selected month. */
  month: string;
  /** "YYYY-MM" of the month before it. */
  previousMonth: string;
  current: PeriodTotals;
  previous: PeriodTotals;
  /** Expense categories with spending in either month, by `current` desc. */
  categories: CategoryComparisonRow[];
  /** Top merchants by total spent in the selected year. */
  topMerchants: MerchantRow[];
}

export interface CashFlowItem {
  name: string;
  total: number;
}

/** Income sources → expense destinations for one year. */
export interface CashFlowReport {
  year: string;
  totalIncome: number;
  totalExpense: number;
  income: CashFlowItem[];
  /** Top expense categories, with the remainder folded into "Other". */
  expense: CashFlowItem[];
  /** income − expense when positive. */
  saved: number;
  /** expense − income when positive. */
  fromSavings: number;
}

export interface TagTransaction {
  id: string;
  date: string;
  categoryName: string;
  amount: number;
  description?: string;
}

export interface TagSummaryRow {
  /** Normalised tag without the leading "#". */
  tag: string;
  total: number;
  count: number;
  transactions: TagTransaction[];
}

export interface TagReport {
  year: string;
  expense: TagSummaryRow[];
  income: TagSummaryRow[];
}

export type ExportKind = "expenses" | "income" | "transfers" | "all";
