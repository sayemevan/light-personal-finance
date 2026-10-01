import "server-only";
import { expensesRepo, incomeRepo } from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { loadLedger } from "@/lib/services/ledger.service";
import {
  getExpensesForYear,
  getIncomeForYear,
  isLiveYear,
} from "@/lib/services/history.service";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type {
  AccountType,
  Expense,
  Income,
  PaymentMethod,
} from "@/types/domain";
import type {
  ImportCheckInput,
  ImportCheckResult,
  ImportExistingRow,
  ImportResult,
  ImportTransactionsData,
} from "@/lib/schemas/import";

/** Statements rarely span more than a couple of years; cap archive reads. */
const MAX_YEARS = 5;

function yearsBetween(from: string, to: string): string[] {
  const start = Number(from.slice(0, 4));
  const end = Number(to.slice(0, 4));
  const years: string[] = [];
  for (let year = Math.max(start, end - MAX_YEARS + 1); year <= end; year++) {
    years.push(String(year));
  }
  return years;
}

/** Rows from the live sheet plus any archived years the range touches. */
async function collectForRange<T extends { id: string; date: string }>(
  years: string[],
  live: T[],
  forYear: (year: string) => Promise<T[]>,
): Promise<T[]> {
  const byId = new Map(live.map((row) => [row.id, row]));
  const archived = await Promise.all(
    years.filter((year) => !isLiveYear(year)).map(forYear),
  );
  for (const rows of archived) {
    for (const row of rows) if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
}

/**
 * Existing expenses/income for one account in a date range (used client-side
 * for duplicate detection) plus a merchant → category map from live expenses
 * for category suggestions.
 */
export async function checkImport(
  input: ImportCheckInput,
): Promise<ImportCheckResult> {
  const ledger = await loadLedger();
  if (!ledger.accounts.some((a) => a.id === input.accountId)) {
    throw AppError.notFound("Account not found.");
  }

  const years = yearsBetween(input.from, input.to);
  const [expenses, income] = await Promise.all([
    collectForRange(years, ledger.expenses, getExpensesForYear),
    collectForRange(years, ledger.income, getIncomeForYear),
  ]);

  const inRange = (row: { accountId: string; date: string }) =>
    row.accountId === input.accountId &&
    row.date >= input.from &&
    row.date <= input.to;

  const existing: ImportExistingRow[] = [
    ...expenses.filter(inRange).map(
      (e): ImportExistingRow => ({
        id: e.id,
        kind: "expense",
        date: e.date,
        amount: e.amount,
        categoryId: e.categoryId,
        merchant: e.merchant,
        notes: e.notes,
      }),
    ),
    ...income.filter(inRange).map(
      (i): ImportExistingRow => ({
        id: i.id,
        kind: "income",
        date: i.date,
        amount: i.amount,
        categoryId: i.categoryId,
        notes: i.notes,
      }),
    ),
  ];

  // Oldest first so the most recent use of a merchant wins.
  const merchantCategories: Record<string, string> = {};
  const sorted = [...ledger.expenses].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  for (const expense of sorted) {
    const merchant = expense.merchant?.trim().toLowerCase();
    if (merchant && expense.categoryId) {
      merchantCategories[merchant] = expense.categoryId;
    }
  }

  return { existing, merchantCategories };
}

function paymentMethodFor(type: AccountType): PaymentMethod {
  switch (type) {
    case "bank":
      return "bank_transfer";
    case "mobile_banking":
      return "mobile_banking";
    case "credit_card":
      return "card";
    default:
      return "other";
  }
}

/** Write imported statement rows: one append call per kind. */
export async function importTransactions(
  input: ImportTransactionsData,
): Promise<ImportResult> {
  const spreadsheetId = await getSpreadsheetId();
  const ledger = await loadLedger(spreadsheetId);

  const account = ledger.accounts.find((a) => a.id === input.accountId);
  if (!account) throw AppError.notFound("Account not found.");

  const categoryKind = new Map(ledger.categories.map((c) => [c.id, c.kind]));
  const badExpense = input.expenses.find(
    (row) => categoryKind.get(row.categoryId) !== "expense",
  );
  const badIncome = input.income.find(
    (row) => categoryKind.get(row.categoryId) !== "income",
  );
  if (badExpense || badIncome) {
    throw AppError.validation("One or more rows use an unknown category.", {
      categoryId: ["Pick a valid category for every row."],
    });
  }

  const now = new Date().toISOString();
  const paymentMethod = paymentMethodFor(account.type);

  const expenses: Expense[] = input.expenses.map((row) => ({
    id: generateId(),
    date: row.date,
    amount: row.amount,
    categoryId: row.categoryId,
    accountId: account.id,
    paymentMethod,
    merchant: row.merchant || undefined,
    notes: row.notes || undefined,
    tags: row.tags?.length ? row.tags : undefined,
    createdAt: now,
    updatedAt: now,
  }));

  const income: Income[] = input.income.map((row) => ({
    id: generateId(),
    date: row.date,
    amount: row.amount,
    categoryId: row.categoryId,
    accountId: account.id,
    notes:
      [row.merchant, row.notes].filter(Boolean).join(" — ") || undefined,
    tags: row.tags?.length ? row.tags : undefined,
    createdAt: now,
    updatedAt: now,
  }));

  if (expenses.length > 0) {
    await expensesRepo.appendMany(spreadsheetId, expenses);
  }
  if (income.length > 0) {
    await incomeRepo.appendMany(spreadsheetId, income);
  }

  return { expenses: expenses.length, income: income.length };
}
