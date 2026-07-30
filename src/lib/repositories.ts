import "server-only";
import { SheetRepository, cell, type RowCodec } from "@/lib/google/repository";
import { SHEET_TABS, SHEET_COLUMNS } from "@/config/google";
import type {
  Account,
  AccountType,
  Category,
  CategoryKind,
  Expense,
  Income,
  Loan,
  LoanPayment,
  LoanPaymentDirection,
  LoanStatus,
  LoanType,
  PaymentMethod,
} from "@/types/domain";

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
  ],
  fromRow: (r) => ({
    id: cell.str(r[0]),
    loanId: cell.str(r[1]),
    date: cell.str(r[2]),
    amount: cell.num(r[3]),
    direction: (cell.str(r[4]) || "payment") as LoanPaymentDirection,
    notes: cell.optional(r[5]),
    createdAt: cell.str(r[6]),
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
