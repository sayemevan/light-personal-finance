import type {
  AccountType,
  AssetCategory,
  CategoryKind,
  InvestmentType,
  LoanStatus,
  LoanType,
  PaymentMethod,
  RecurringFrequency,
  RecurringKind,
} from "@/types/domain";

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  expense: "Expense",
  income: "Income",
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank",
  credit_card: "Credit Card",
  mobile_banking: "Mobile Banking",
  custom: "Custom",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  mobile_banking: "Mobile Banking",
  other: "Other",
};

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  borrowed: "Borrowed",
  lent: "Lent",
};

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  active: "Active",
  settled: "Settled",
  overdue: "Overdue",
};

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  stocks: "Stocks",
  mutual_fund: "Mutual Fund",
  etf: "ETF",
  crypto: "Crypto",
  fixed_deposit: "Fixed Deposit",
  gold: "Gold",
  custom: "Custom",
};

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  house: "House",
  land: "Land",
  vehicle: "Vehicle",
  jewelry: "Jewelry",
  electronics: "Electronics",
  other: "Other",
};

export const RECURRING_KIND_LABELS: Record<RecurringKind, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
};

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/** Build `{ label, value }[]` option lists from a label map. */
export function toOptions<T extends string>(
  labels: Record<T, string>,
): { label: string; value: T }[] {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));
}

export const CATEGORY_KIND_OPTIONS = toOptions(CATEGORY_KIND_LABELS);
export const ACCOUNT_TYPE_OPTIONS = toOptions(ACCOUNT_TYPE_LABELS);
export const PAYMENT_METHOD_OPTIONS = toOptions(PAYMENT_METHOD_LABELS);
export const LOAN_TYPE_OPTIONS = toOptions(LOAN_TYPE_LABELS);
export const LOAN_STATUS_OPTIONS = toOptions(LOAN_STATUS_LABELS);
export const INVESTMENT_TYPE_OPTIONS = toOptions(INVESTMENT_TYPE_LABELS);
export const ASSET_CATEGORY_OPTIONS = toOptions(ASSET_CATEGORY_LABELS);
export const RECURRING_KIND_OPTIONS = toOptions(RECURRING_KIND_LABELS);
export const RECURRING_FREQUENCY_OPTIONS = toOptions(RECURRING_FREQUENCY_LABELS);
