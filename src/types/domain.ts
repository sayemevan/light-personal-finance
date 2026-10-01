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

export type InvestmentTransactionDirection = "income" | "loss";

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
  /** Free-form labels such as "trip-coxsbazar" (stored comma-separated). */
  tags?: string[];
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
  tags?: string[];
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/** Money moved between two of the user's own accounts. Not income/expense. */
export interface Transfer {
  id: string;
  date: ISODateString;
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  notes?: string;
  createdAt: ISODateTimeString;
}

/** Category id used for a budget that caps total monthly spending. */
export const OVERALL_BUDGET_ID = "__overall__";

/** A monthly spending limit for one expense category (or overall). */
export interface Budget {
  id: string;
  /** Expense category id, or `OVERALL_BUDGET_ID`. */
  categoryId: string;
  /** Monthly limit. */
  amount: number;
  createdAt: ISODateTimeString;
}

/** Budget usage for one month. Derived, never stored. */
export interface BudgetStatus extends Budget {
  month: string; // "2026-07"
  spent: number;
  remaining: number;
  /** spent / amount, 0..∞ */
  ratio: number;
  level: "ok" | "warning" | "exceeded";
}

/** A savings target. */
export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate?: ISODateString;
  /**
   * When set, progress tracks this account's balance (a dedicated savings
   * account). Otherwise progress is the sum of manual contributions.
   */
  accountId?: string;
  isArchived: boolean;
  createdAt: ISODateTimeString;
  /** Derived, not persisted. */
  savedAmount?: number;
  /** Derived: amount still needed per month to hit `targetDate`. */
  monthlyNeeded?: number;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  date: ISODateString;
  /** Positive adds to the goal, negative withdraws from it. */
  amount: number;
  notes?: string;
  createdAt: ISODateTimeString;
}

export type RecurringKind = "expense" | "income" | "transfer";
export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

/** A template that generates expenses, income or transfers on a schedule. */
export interface RecurringRule {
  id: string;
  kind: RecurringKind;
  name: string;
  amount: number;
  /** Expense/income category. Unused for transfers. */
  categoryId?: string;
  /** Account charged (expense), credited (income) or the transfer source. */
  accountId: string;
  /** Transfer destination. */
  toAccountId?: string;
  paymentMethod?: PaymentMethod;
  frequency: RecurringFrequency;
  /** Repeat every N periods (e.g. 2 + weekly = fortnightly). */
  interval: number;
  startDate: ISODateString;
  endDate?: ISODateString;
  /** The next date an occurrence is due. */
  nextDate: ISODateString;
  /** Post automatically when due; otherwise wait for the user to confirm. */
  autoPost: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: ISODateTimeString;
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
  /**
   * Derived: the status as saved by the user ("active" or a manual
   * "settled"). `status` itself is the effective one shown in the UI, which
   * also turns overdue / settled automatically.
   */
  storedStatus?: LoanStatus;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  date: ISODateString;
  amount: number;
  direction: LoanPaymentDirection;
  /**
   * Account the repayment moved through: deducted from on a payment, or
   * credited on a receipt. Falls back to the parent loan's account when empty
   * (legacy rows written before this field existed).
   */
  accountId?: string;
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

export interface InvestmentTransaction {
  id: string;
  investmentId: string;
  date: ISODateString;
  amount: number;
  direction: InvestmentTransactionDirection;
  /**
   * For income entries: the account the money was added to. Not used for loss
   * entries (a loss reduces the investment's current value, not an account).
   */
  accountId?: string;
  notes?: string;
  createdAt: ISODateTimeString;
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
  /** Still owed on borrowed loans (active or overdue). */
  outstandingLoans: number;
  /** Still owed to you on lent loans (active or overdue). */
  moneyLent: number;
  upcomingDuePayments: Loan[];
  monthlySummary: MonthlyPoint[];
  /** Total current value of all investments. */
  investmentValue: number;
  /** Total current estimated value of all assets. */
  assetValue: number;
  /** Cash + investments + assets + money lent − outstanding loans. */
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
