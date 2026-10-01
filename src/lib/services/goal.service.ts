import "server-only";
import {
  accountsRepo,
  goalContributionsRepo,
  goalsRepo,
} from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { loadLedger, type Ledger } from "@/lib/services/ledger.service";
import { computeAccountBalance, computeGoalProgress } from "@/lib/finance";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type { Goal, GoalContribution } from "@/types/domain";
import type {
  CreateGoalContributionInput,
  CreateGoalInput,
} from "@/lib/schemas";

export type GoalUpdateInput = Partial<CreateGoalInput> & {
  isArchived?: boolean;
};

/** Attach the derived `savedAmount` / `monthlyNeeded` to a goal. */
function withProgress(goal: Goal, ledger: Ledger): Goal {
  const account = goal.accountId
    ? ledger.accounts.find((a) => a.id === goal.accountId)
    : undefined;
  const balance = account ? computeAccountBalance(account, ledger) : undefined;
  return {
    ...goal,
    ...computeGoalProgress(goal, ledger.goalContributions, balance),
  };
}

/** All goals (archived included) with progress, newest first. */
export async function listGoals(): Promise<Goal[]> {
  const ledger = await loadLedger();
  return ledger.goals
    .map((goal) => withProgress(goal, ledger))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getGoal(
  id: string,
): Promise<Goal & { contributions: GoalContribution[] }> {
  const ledger = await loadLedger();
  const goal = ledger.goals.find((g) => g.id === id);
  if (!goal) throw AppError.notFound("Goal not found.");
  const contributions = ledger.goalContributions
    .filter((c) => c.goalId === id)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  return { ...withProgress(goal, ledger), contributions };
}

async function assertAccount(
  spreadsheetId: string,
  accountId: string,
): Promise<void> {
  const account = await accountsRepo.findById(spreadsheetId, accountId);
  if (!account) throw AppError.validation("Account not found.");
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const spreadsheetId = await getSpreadsheetId();
  const accountId = input.accountId || undefined;
  if (accountId) await assertAccount(spreadsheetId, accountId);
  const goal: Goal = {
    id: generateId(),
    name: input.name,
    targetAmount: input.targetAmount,
    targetDate: input.targetDate || undefined,
    accountId,
    isArchived: false,
    createdAt: new Date().toISOString(),
  };
  return goalsRepo.create(spreadsheetId, goal);
}

/**
 * A key present with an empty / undefined value clears that optional field
 * (e.g. `targetDate`, `accountId`); an absent key leaves it unchanged.
 */
export async function updateGoal(
  id: string,
  input: GoalUpdateInput,
): Promise<Goal> {
  const spreadsheetId = await getSpreadsheetId();
  const current = await goalsRepo.findById(spreadsheetId, id);
  if (!current) throw AppError.notFound("Goal not found.");

  const patch: Partial<Goal> = { ...input };
  if ("accountId" in input) {
    patch.accountId = input.accountId || undefined;
    if (patch.accountId) await assertAccount(spreadsheetId, patch.accountId);
  }
  if ("targetDate" in input) patch.targetDate = input.targetDate || undefined;
  // Derived fields are never persisted.
  delete patch.savedAmount;
  delete patch.monthlyNeeded;
  return goalsRepo.update(spreadsheetId, id, patch);
}

export async function deleteGoal(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  const goal = await goalsRepo.findById(spreadsheetId, id);
  if (!goal) throw AppError.notFound("Goal not found.");

  // Remove contributions first (each removal re-reads the sheet).
  const contributions = (await goalContributionsRepo.list(spreadsheetId)).filter(
    (c) => c.goalId === id,
  );
  for (const contribution of contributions) {
    await goalContributionsRepo.remove(spreadsheetId, contribution.id);
  }

  await goalsRepo.remove(spreadsheetId, id);
}

export async function addGoalContribution(
  input: CreateGoalContributionInput,
): Promise<GoalContribution> {
  const spreadsheetId = await getSpreadsheetId();
  const [goal, contributions] = await Promise.all([
    goalsRepo.findById(spreadsheetId, input.goalId),
    goalContributionsRepo.list(spreadsheetId),
  ]);
  if (!goal) throw AppError.notFound("Goal not found.");
  if (goal.accountId) {
    throw AppError.validation(
      "This goal tracks an account balance. Add money to that account instead.",
    );
  }
  if (input.amount < 0) {
    const saved = contributions
      .filter((c) => c.goalId === goal.id)
      .reduce((total, c) => total + c.amount, 0);
    if (saved + input.amount < -0.005) {
      throw AppError.validation("You can't withdraw more than you've saved.");
    }
  }

  const contribution: GoalContribution = {
    id: generateId(),
    goalId: goal.id,
    date: input.date,
    amount: input.amount,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  return goalContributionsRepo.create(spreadsheetId, contribution);
}

export async function deleteGoalContribution(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await goalContributionsRepo.remove(spreadsheetId, id);
}
