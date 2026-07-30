import "server-only";
import { expensesRepo } from "@/lib/repositories";
import { getWorkspaceForCurrentUser } from "@/lib/google/workspace";
import { deleteFile } from "@/lib/google/drive";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type { Expense } from "@/types/domain";
import type { CreateExpenseInput } from "@/lib/schemas";

/** List every expense (client handles search / filter / sort / paging). */
export async function listExpenses(): Promise<Expense[]> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const expenses = await expensesRepo.list(spreadsheetId);
  return expenses.sort((a, b) => b.date.localeCompare(a.date));
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
