import "server-only";
import {
  accountsRepo,
  categoriesRepo,
  expensesRepo,
} from "@/lib/repositories";
import { getWorkspaceForCurrentUser } from "@/lib/google/workspace";
import { deleteFile } from "@/lib/google/drive";
import { queryCollection } from "@/lib/services/query";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type { Expense } from "@/types/domain";
import type { Paginated } from "@/types/api";
import type { CreateExpenseInput, ExpenseListQuery } from "@/lib/schemas";

/**
 * Return a single page of expenses, applying account/category filters plus
 * server-side search and sort so the client only receives what it renders.
 * Defaults to newest first when no explicit sort is requested.
 */
export async function listExpenses(
  query: ExpenseListQuery,
): Promise<Paginated<Expense>> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const [expenses, accounts, categories] = await Promise.all([
    expensesRepo.list(spreadsheetId),
    accountsRepo.list(spreadsheetId),
    categoriesRepo.list(spreadsheetId),
  ]);

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? "";
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "";

  let rows = expenses;
  if (query.categoryId) {
    rows = rows.filter((e) => e.categoryId === query.categoryId);
  }
  if (query.accountId) {
    rows = rows.filter((e) => e.accountId === query.accountId);
  }

  return queryCollection(
    rows,
    [
      { key: "date", get: (e) => e.date, searchable: true, sortable: true },
      {
        key: "category",
        get: (e) => categoryName(e.categoryId),
        searchable: true,
        sortable: true,
      },
      {
        key: "account",
        get: (e) => accountName(e.accountId),
        searchable: true,
        sortable: true,
      },
      {
        key: "merchant",
        get: (e) => `${e.merchant ?? ""} ${e.notes ?? ""}`,
        searchable: true,
      },
      { key: "amount", get: (e) => e.amount, sortable: true },
    ],
    {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      sortBy: query.sortBy ?? "date",
      sortDir: query.sortDir ?? "desc",
    },
  );
}

export async function getExpense(id: string): Promise<Expense> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const expense = await expensesRepo.findById(spreadsheetId, id);
  if (!expense) throw AppError.notFound("Expense not found.");
  return expense;
}

export async function createExpense(
  input: CreateExpenseInput,
): Promise<Expense> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const now = new Date().toISOString();
  const expense: Expense = {
    id: generateId(),
    date: input.date,
    amount: input.amount,
    categoryId: input.categoryId,
    accountId: input.accountId,
    paymentMethod: input.paymentMethod,
    merchant: input.merchant,
    notes: input.notes,
    receiptFileId: input.receiptFileId,
    createdAt: now,
    updatedAt: now,
  };
  return expensesRepo.create(spreadsheetId, expense);
}

export async function updateExpense(
  id: string,
  input: Partial<CreateExpenseInput>,
): Promise<Expense> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  return expensesRepo.update(spreadsheetId, id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const expense = await expensesRepo.findById(spreadsheetId, id);
  if (!expense) throw AppError.notFound("Expense not found.");

  // Best-effort receipt cleanup; never block deletion on Drive errors.
  if (expense.receiptFileId) {
    try {
      await deleteFile(expense.receiptFileId);
    } catch (error) {
      console.error("[expense] failed to delete receipt", error);
    }
  }

  await expensesRepo.remove(spreadsheetId, id);
}
