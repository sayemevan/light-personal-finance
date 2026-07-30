import type {
  AccountType,
  CategoryKind,
  LoanStatus,
  LoanType,
  PaymentMethod,
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
