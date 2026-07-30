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

export type InvestmentType =
  | "stocks"
  | "mutual_fund"
  | "etf"
  | "crypto"
  | "fixed_deposit"
  | "gold"
  | "custom";

export type AssetCategory =
  | "house"
  | "land"
  | "vehicle"
  | "jewelry"
  | "electronics"
  | "other";

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
  /**
   * Account the money moved through: where a borrowed loan was received, or
   * which account a lent amount was paid from.
   */
  accountId?: string;
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

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  purchaseDate: ISODateString;
  /** Amount originally invested (cost basis). */
  amountInvested: number;
  /** Latest known market value of the holding. */
  currentValue: number;
  /**
   * Optional account the money came from. When set, the invested amount is
   * deducted from that account's cash balance. When empty, the purchase is
   * treated as funded by an untracked external source.
   */
  accountId?: string;
  notes?: string;
  createdAt: ISODateTimeString;
  /** Derived, not persisted: currentValue − amountInvested. */
  gain?: number;
  /** Derived, not persisted: gain as a percentage of amountInvested. */
  returnPct?: number;
}

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  purchaseDate: ISODateString;
  /** Amount paid to acquire the asset. */
  purchaseValue: number;
  /** Latest estimated value of the asset. */
  currentValue: number;
  /**
   * Optional account the money came from. When set, the purchase value is
   * deducted from that account's cash balance. When empty, the purchase is
   * treated as funded by an untracked external source.
   */
  accountId?: string;
  notes?: string;
  createdAt: ISODateTimeString;
  /** Derived, not persisted: currentValue − purchaseValue. */
  gain?: number;
  /** Derived, not persisted: gain as a percentage of purchaseValue. */
  returnPct?: number;
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
  /** Total current value of all investments. */
  investmentValue: number;
  /** Total current estimated value of all assets. */
  assetValue: number;
  /** Cash (account balances) + investments + assets. */
  netWorth: number;
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
