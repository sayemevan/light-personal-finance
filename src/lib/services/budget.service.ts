import "server-only";
import { budgetsRepo, categoriesRepo } from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { loadLedger } from "@/lib/services/ledger.service";
import { computeBudgetStatuses, monthKey } from "@/lib/finance";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import { OVERALL_BUDGET_ID } from "@/types/domain";
import type { Budget, BudgetStatus } from "@/types/domain";
import type { CreateBudgetInput } from "@/lib/schemas";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function currentMonth(): string {
  return monthKey(new Date().toISOString());
}

/** Overall first, then the most-used budgets. */
function sortStatuses(statuses: BudgetStatus[]): BudgetStatus[] {
  return [...statuses].sort((a, b) => {
    const aOverall = a.categoryId === OVERALL_BUDGET_ID ? 0 : 1;
    const bOverall = b.categoryId === OVERALL_BUDGET_ID ? 0 : 1;
    return aOverall - bOverall || b.ratio - a.ratio;
  });
}

/** Every budget with its usage for `month` ("YYYY-MM", default this month). */
export async function listBudgetStatuses(
  month: string = currentMonth(),
): Promise<BudgetStatus[]> {
  if (!MONTH_PATTERN.test(month)) {
    throw AppError.validation("Expected a month in YYYY-MM format.");
  }
  const { budgets, expenses } = await loadLedger();
  return sortStatuses(computeBudgetStatuses(budgets, expenses, month));
}

async function assertBudgetCategory(
  spreadsheetId: string,
  categoryId: string,
): Promise<void> {
  if (categoryId === OVERALL_BUDGET_ID) return;
  const category = await categoriesRepo.findById(spreadsheetId, categoryId);
  if (!category || category.kind !== "expense") {
    throw AppError.validation("Choose an expense category.");
  }
}

async function assertUniqueCategory(
  spreadsheetId: string,
  categoryId: string,
  exceptId?: string,
): Promise<void> {
  const budgets = await budgetsRepo.list(spreadsheetId);
  if (budgets.some((b) => b.categoryId === categoryId && b.id !== exceptId)) {
    throw AppError.validation("A budget for this category already exists.");
  }
}

export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const spreadsheetId = await getSpreadsheetId();
  await assertBudgetCategory(spreadsheetId, input.categoryId);
  await assertUniqueCategory(spreadsheetId, input.categoryId);
  const budget: Budget = {
    id: generateId(),
    categoryId: input.categoryId,
    amount: input.amount,
    createdAt: new Date().toISOString(),
  };
  return budgetsRepo.create(spreadsheetId, budget);
}

export async function updateBudget(
  id: string,
  input: Partial<CreateBudgetInput>,
): Promise<Budget> {
  const spreadsheetId = await getSpreadsheetId();
  const current = await budgetsRepo.findById(spreadsheetId, id);
  if (!current) throw AppError.notFound("Budget not found.");
  if (input.categoryId && input.categoryId !== current.categoryId) {
    await assertBudgetCategory(spreadsheetId, input.categoryId);
    await assertUniqueCategory(spreadsheetId, input.categoryId, id);
  }
  return budgetsRepo.update(spreadsheetId, id, input);
}

export async function deleteBudget(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await budgetsRepo.remove(spreadsheetId, id);
}

/**
 * After an expense is saved: the most severe budget alert (category or
 * overall) for the expense's month once usage reaches 80%, else null.
 */
export async function getBudgetAlert(
  categoryId: string,
  date: string,
): Promise<{
  categoryName: string;
  spent: number;
  limit: number;
  level: "warning" | "exceeded";
} | null> {
  const { budgets, expenses, categories } = await loadLedger();
  const relevant = budgets.filter(
    (b) => b.categoryId === categoryId || b.categoryId === OVERALL_BUDGET_ID,
  );
  if (relevant.length === 0) return null;

  const worst = computeBudgetStatuses(relevant, expenses, monthKey(date))
    .filter((status) => status.level !== "ok")
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (!worst || worst.level === "ok") return null;

  return {
    categoryName:
      worst.categoryId === OVERALL_BUDGET_ID
        ? "Overall"
        : (categories.find((c) => c.id === worst.categoryId)?.name ??
          "Budget"),
    spent: worst.spent,
    limit: worst.amount,
    level: worst.level,
  };
}
