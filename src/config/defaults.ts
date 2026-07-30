import type { AccountType, CategoryKind } from "@/types/domain";

/**
 * Seed data written into a freshly created Finance spreadsheet. Users can edit,
 * archive, or add to these afterwards.
 */

export const DEFAULT_ACCOUNTS: { name: string; type: AccountType }[] = [
  { name: "Cash", type: "cash" },
  { name: "Bank", type: "bank" },
  { name: "Credit Card", type: "credit_card" },
  { name: "Mobile Banking", type: "mobile_banking" },
];

export const DEFAULT_CATEGORIES: {
  name: string;
  kind: CategoryKind;
  icon?: string;
}[] = [
  { name: "Food", kind: "expense" },
  { name: "Transport", kind: "expense" },
  { name: "Shopping", kind: "expense" },
  { name: "Medical", kind: "expense" },
  { name: "Entertainment", kind: "expense" },
  { name: "Bills", kind: "expense" },
  { name: "Education", kind: "expense" },
  { name: "Salary", kind: "income" },
  { name: "Investment", kind: "income" },
];

export const DEFAULT_CURRENCY = "USD";
