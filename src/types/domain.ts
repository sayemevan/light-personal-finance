/**
 * Domain models. These are the shapes the application works with in memory,
 * independent of how they are stored as rows in Google Sheets.
 */

export type ISODateString = string; // e.g. "2026-07-30"
export type ISODateTimeString = string; // e.g. "2026-07-30T14:00:00.000Z"

export type AccountType =
  | "cash"
  | "bank"
  | "credit_card"
  | "mobile_banking"
  | "custom";

export type CategoryKind = "expense" | "income";

export type PaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "mobile_banking"
  | "other";

export type LoanType = "borrowed" | "lent";

export type LoanStatus = "active" | "settled" | "overdue";

export type LoanPaymentDirection = "payment" | "receipt";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  currency: string;
  isArchived: boolean;
  createdAt: ISODateTimeString;
  /** Derived, not persisted. */
  currentBalance?: number;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  icon?: string;
  isDefault: boolean;
  isArchived: boolean;
}

export interface Expense {
  id: string;
  date: ISODateString;
  amount: number;
  categoryId: string;
  accountId: string;
  paymentMethod: PaymentMethod;
  merchant?: string;
  notes?: string;
  receiptFileId?: string;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface Income {
  id: string;
  date: ISODateString;
  amount: number;
  categoryId: string;
  accountId: string;
  notes?: string;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface Loan {
  id: string;
  type: LoanType;
  person: string;
  principal: number;
  interestRate?: number;
  borrowDate: ISODateString;
  dueDate?: ISODateString;
  status: LoanStatus;
  notes?: string;
  createdAt: ISODateTimeString;
  /** Derived, not persisted. */
  remainingBalance?: number;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  date: ISODateString;
  amount: number;
  direction: LoanPaymentDirection;
  notes?: string;
  createdAt: ISODateTimeString;
}

export interface DashboardSummary {
  totalBalance: number;
  monthExpense: number;
  monthIncome: number;
  savings: number;
  recentTransactions: Transaction[];
  outstandingLoans: number;
  moneyLent: number;
  upcomingDuePayments: Loan[];
  monthlySummary: MonthlyPoint[];
}

/** A unified view of an expense or income for lists such as "recent". */
export interface Transaction {
  id: string;
  kind: "expense" | "income";
  date: ISODateString;
  amount: number;
  categoryId: string;
  accountId: string;
  description?: string;
}

export interface MonthlyPoint {
  month: string; // "2026-07"
  income: number;
  expense: number;
}
