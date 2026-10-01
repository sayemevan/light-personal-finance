import "server-only";
import { SheetRepository, cell, type RowCodec } from "@/lib/google/repository";
import { SHEET_TABS, SHEET_COLUMNS } from "@/config/google";
import type {
  Account,
  AccountType,
  Asset,
  AssetCategory,
  Category,
  CategoryKind,
  Budget,
  Expense,
  Goal,
  GoalContribution,
  Income,
  Investment,
  InvestmentTransaction,
  InvestmentTransactionDirection,
  InvestmentType,
  Loan,
  LoanPayment,
  LoanPaymentDirection,
  LoanStatus,
  LoanType,
  PaymentMethod,
  RecurringFrequency,
  RecurringKind,
  RecurringRule,
  Transfer,
} from "@/types/domain";

/** Tags are stored as one comma-separated cell. */
function encodeTags(tags: string[] | undefined): string {
  return (tags ?? []).join(", ");
}

function decodeTags(value: string | undefined): string[] | undefined {
  const tags = (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

/**
 * Codecs + repository instances for every worksheet, declared once and shared
 * by all services. Column order must match `SHEET_COLUMNS`.
 */

const accountCodec: RowCodec<Account> = {
  toRow: (a) => [
    a.id,
    a.name,
    a.type,
    a.openingBalance,
    a.currency,
    a.isArchived ? "TRUE" : "FALSE",
    a.createdAt,
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    name: cell.str(r[1]),
    type: (cell.str(r[2]) || "custom") as AccountType,
    openingBalance: cell.num(r[3]),
    currency: cell.str(r[4]) || "USD",
    isArchived: cell.bool(r[5]),
    createdAt: cell.str(r[6]),
  }),
};

const categoryCodec: RowCodec<Category> = {
  toRow: (c) => [
    c.id,
    c.name,
    c.kind,
    c.icon ?? "",
    c.isDefault ? "TRUE" : "FALSE",
    c.isArchived ? "TRUE" : "FALSE",
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    name: cell.str(r[1]),
    kind: (cell.str(r[2]) || "expense") as CategoryKind,
    icon: cell.optional(r[3]),
    isDefault: cell.bool(r[4]),
    isArchived: cell.bool(r[5]),
  }),
};

const expenseCodec: RowCodec<Expense> = {
  toRow: (e) => [
    e.id,
    e.date,
    e.amount,
    e.categoryId,
    e.accountId,
    e.paymentMethod,
    e.merchant ?? "",
    e.notes ?? "",
    e.receiptFileId ?? "",
    e.createdAt,
    e.updatedAt,
    encodeTags(e.tags),
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    date: cell.str(r[1]),
    amount: cell.num(r[2]),
    categoryId: cell.str(r[3]),
    accountId: cell.str(r[4]),
    paymentMethod: (cell.str(r[5]) || "other") as PaymentMethod,
    merchant: cell.optional(r[6]),
    notes: cell.optional(r[7]),
    receiptFileId: cell.optional(r[8]),
    createdAt: cell.str(r[9]),
    updatedAt: cell.str(r[10]),
    tags: decodeTags(r[11]),
  }),
};

const incomeCodec: RowCodec<Income> = {
  toRow: (i) => [
    i.id,
    i.date,
    i.amount,
    i.categoryId,
    i.accountId,
    i.notes ?? "",
    i.createdAt,
    i.updatedAt,
    encodeTags(i.tags),
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    date: cell.str(r[1]),
    amount: cell.num(r[2]),
    categoryId: cell.str(r[3]),
    accountId: cell.str(r[4]),
    notes: cell.optional(r[5]),
    createdAt: cell.str(r[6]),
    updatedAt: cell.str(r[7]),
    tags: decodeTags(r[8]),
  }),
};

const loanCodec: RowCodec<Loan> = {
  toRow: (l) => [
    l.id,
    l.type,
    l.person,
    l.principal,
    l.interestRate ?? "",
    l.borrowDate,
    l.dueDate ?? "",
    l.status,
    l.notes ?? "",
    l.createdAt,
    l.accountId ?? "",
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    type: (cell.str(r[1]) || "borrowed") as LoanType,
    person: cell.str(r[2]),
    principal: cell.num(r[3]),
    interestRate: cell.optionalNum(r[4]),
    borrowDate: cell.str(r[5]),
    dueDate: cell.optional(r[6]),
    status: (cell.str(r[7]) || "active") as LoanStatus,
    notes: cell.optional(r[8]),
    createdAt: cell.str(r[9]),
    accountId: cell.optional(r[10]),
  }),
};

const loanPaymentCodec: RowCodec<LoanPayment> = {
  toRow: (p) => [
    p.id,
    p.loanId,
    p.date,
    p.amount,
    p.direction,
    p.notes ?? "",
    p.createdAt,
    p.accountId ?? "",
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    loanId: cell.str(r[1]),
    date: cell.str(r[2]),
    amount: cell.num(r[3]),
    direction: (cell.str(r[4]) || "payment") as LoanPaymentDirection,
    notes: cell.optional(r[5]),
    createdAt: cell.str(r[6]),
    accountId: cell.optional(r[7]),
  }),
};

const investmentCodec: RowCodec<Investment> = {
  toRow: (v) => [
    v.id,
    v.name,
    v.type,
    v.purchaseDate,
    v.amountInvested,
    v.currentValue,
    v.notes ?? "",
    v.createdAt,
    v.accountId ?? "",
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    name: cell.str(r[1]),
    type: (cell.str(r[2]) || "custom") as InvestmentType,
    purchaseDate: cell.str(r[3]),
    amountInvested: cell.num(r[4]),
    currentValue: cell.num(r[5]),
    notes: cell.optional(r[6]),
    createdAt: cell.str(r[7]),
    accountId: cell.optional(r[8]),
  }),
};

const investmentTransactionCodec: RowCodec<InvestmentTransaction> = {
  toRow: (t) => [
    t.id,
    t.investmentId,
    t.date,
    t.amount,
    t.direction,
    t.accountId ?? "",
    t.notes ?? "",
    t.createdAt,
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    investmentId: cell.str(r[1]),
    date: cell.str(r[2]),
    amount: cell.num(r[3]),
    direction: (cell.str(r[4]) || "income") as InvestmentTransactionDirection,
    accountId: cell.optional(r[5]),
    notes: cell.optional(r[6]),
    createdAt: cell.str(r[7]),
  }),
};

const assetCodec: RowCodec<Asset> = {
  toRow: (a) => [
    a.id,
    a.name,
    a.category,
    a.purchaseDate,
    a.purchaseValue,
    a.currentValue,
    a.notes ?? "",
    a.createdAt,
    a.accountId ?? "",
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    name: cell.str(r[1]),
    category: (cell.str(r[2]) || "other") as AssetCategory,
    purchaseDate: cell.str(r[3]),
    purchaseValue: cell.num(r[4]),
    currentValue: cell.num(r[5]),
    notes: cell.optional(r[6]),
    createdAt: cell.str(r[7]),
    accountId: cell.optional(r[8]),
  }),
};

const transferCodec: RowCodec<Transfer> = {
  toRow: (t) => [
    t.id,
    t.date,
    t.amount,
    t.fromAccountId,
    t.toAccountId,
    t.notes ?? "",
    t.createdAt,
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    date: cell.str(r[1]),
    amount: cell.num(r[2]),
    fromAccountId: cell.str(r[3]),
    toAccountId: cell.str(r[4]),
    notes: cell.optional(r[5]),
    createdAt: cell.str(r[6]),
  }),
};

const budgetCodec: RowCodec<Budget> = {
  toRow: (b) => [b.id, b.categoryId, b.amount, b.createdAt],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    categoryId: cell.str(r[1]),
    amount: cell.num(r[2]),
    createdAt: cell.str(r[3]),
  }),
};

const goalCodec: RowCodec<Goal> = {
  toRow: (g) => [
    g.id,
    g.name,
    g.targetAmount,
    g.targetDate ?? "",
    g.accountId ?? "",
    g.isArchived ? "TRUE" : "FALSE",
    g.createdAt,
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    name: cell.str(r[1]),
    targetAmount: cell.num(r[2]),
    targetDate: cell.optional(r[3]),
    accountId: cell.optional(r[4]),
    isArchived: cell.bool(r[5]),
    createdAt: cell.str(r[6]),
  }),
};

const goalContributionCodec: RowCodec<GoalContribution> = {
  toRow: (c) => [c.id, c.goalId, c.date, c.amount, c.notes ?? "", c.createdAt],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    goalId: cell.str(r[1]),
    date: cell.str(r[2]),
    amount: cell.num(r[3]),
    notes: cell.optional(r[4]),
    createdAt: cell.str(r[5]),
  }),
};

const recurringCodec: RowCodec<RecurringRule> = {
  toRow: (x) => [
    x.id,
    x.kind,
    x.name,
    x.amount,
    x.categoryId ?? "",
    x.accountId,
    x.toAccountId ?? "",
    x.paymentMethod ?? "",
    x.frequency,
    x.interval,
    x.startDate,
    x.endDate ?? "",
    x.nextDate,
    x.autoPost ? "TRUE" : "FALSE",
    x.isActive ? "TRUE" : "FALSE",
    x.notes ?? "",
    x.createdAt,
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    kind: (cell.str(r[1]) || "expense") as RecurringKind,
    name: cell.str(r[2]),
    amount: cell.num(r[3]),
    categoryId: cell.optional(r[4]),
    accountId: cell.str(r[5]),
    toAccountId: cell.optional(r[6]),
    paymentMethod: cell.optional(r[7]) as PaymentMethod | undefined,
    frequency: (cell.str(r[8]) || "monthly") as RecurringFrequency,
    interval: Math.max(1, Math.round(cell.num(r[9])) || 1),
    startDate: cell.str(r[10]),
    endDate: cell.optional(r[11]),
    nextDate: cell.str(r[12]),
    autoPost: cell.bool(r[13]),
    isActive: cell.bool(r[14]),
    notes: cell.optional(r[15]),
    createdAt: cell.str(r[16]),
  }),
};

export const accountsRepo = new SheetRepository<Account>(
  SHEET_TABS.accounts,
  SHEET_COLUMNS[SHEET_TABS.accounts].length,
  accountCodec,
);

export const categoriesRepo = new SheetRepository<Category>(
  SHEET_TABS.categories,
  SHEET_COLUMNS[SHEET_TABS.categories].length,
  categoryCodec,
);

export const expensesRepo = new SheetRepository<Expense>(
  SHEET_TABS.expenses,
  SHEET_COLUMNS[SHEET_TABS.expenses].length,
  expenseCodec,
);

export const incomeRepo = new SheetRepository<Income>(
  SHEET_TABS.income,
  SHEET_COLUMNS[SHEET_TABS.income].length,
  incomeCodec,
);

export const loansRepo = new SheetRepository<Loan>(
  SHEET_TABS.loans,
  SHEET_COLUMNS[SHEET_TABS.loans].length,
  loanCodec,
);

export const loanPaymentsRepo = new SheetRepository<LoanPayment>(
  SHEET_TABS.loanPayments,
  SHEET_COLUMNS[SHEET_TABS.loanPayments].length,
  loanPaymentCodec,
);

export const investmentsRepo = new SheetRepository<Investment>(
  SHEET_TABS.investments,
  SHEET_COLUMNS[SHEET_TABS.investments].length,
  investmentCodec,
);

export const investmentTransactionsRepo =
  new SheetRepository<InvestmentTransaction>(
    SHEET_TABS.investmentTransactions,
    SHEET_COLUMNS[SHEET_TABS.investmentTransactions].length,
    investmentTransactionCodec,
  );

export const assetsRepo = new SheetRepository<Asset>(
  SHEET_TABS.assets,
  SHEET_COLUMNS[SHEET_TABS.assets].length,
  assetCodec,
);

export const transfersRepo = new SheetRepository<Transfer>(
  SHEET_TABS.transfers,
  SHEET_COLUMNS[SHEET_TABS.transfers].length,
  transferCodec,
);

export const budgetsRepo = new SheetRepository<Budget>(
  SHEET_TABS.budgets,
  SHEET_COLUMNS[SHEET_TABS.budgets].length,
  budgetCodec,
);

export const goalsRepo = new SheetRepository<Goal>(
  SHEET_TABS.goals,
  SHEET_COLUMNS[SHEET_TABS.goals].length,
  goalCodec,
);

export const goalContributionsRepo = new SheetRepository<GoalContribution>(
  SHEET_TABS.goalContributions,
  SHEET_COLUMNS[SHEET_TABS.goalContributions].length,
  goalContributionCodec,
);

export const recurringRepo = new SheetRepository<RecurringRule>(
  SHEET_TABS.recurring,
  SHEET_COLUMNS[SHEET_TABS.recurring].length,
  recurringCodec,
);
