import "server-only";
import { incomeRepo } from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type { Income } from "@/types/domain";
import type { CreateIncomeInput } from "@/lib/schemas";

export async function listIncome(): Promise<Income[]> {
  const spreadsheetId = await getSpreadsheetId();
  const income = await incomeRepo.list(spreadsheetId);
  return income.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getIncome(id: string): Promise<Income> {
  const spreadsheetId = await getSpreadsheetId();
  const income = await incomeRepo.findById(spreadsheetId, id);
  if (!income) throw AppError.notFound("Income not found.");
  return income;
}

export async function createIncome(input: CreateIncomeInput): Promise<Income> {
  const spreadsheetId = await getSpreadsheetId();
  const now = new Date().toISOString();
  const income: Income = {
    id: generateId(),
    date: input.date,
    amount: input.amount,
    categoryId: input.categoryId,
    accountId: input.accountId,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  return incomeRepo.create(spreadsheetId, income);
}

export async function updateIncome(
  id: string,
  input: Partial<CreateIncomeInput>,
): Promise<Income> {
  const spreadsheetId = await getSpreadsheetId();
  return incomeRepo.update(spreadsheetId, id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteIncome(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await incomeRepo.remove(spreadsheetId, id);
}
