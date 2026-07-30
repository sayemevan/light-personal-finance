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
