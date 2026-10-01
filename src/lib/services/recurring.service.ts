import "server-only";
import type { z } from "zod";
import { accountsRepo, categoriesRepo, recurringRepo } from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { createExpense } from "@/lib/services/expense.service";
import { createIncome } from "@/lib/services/income.service";
import { createTransfer } from "@/lib/services/transfer.service";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import {
  addDays,
  firstOccurrenceOnOrAfter,
  nextOccurrence,
  occurrencesDue,
  withinEnd,
} from "@/lib/recurring";
import type { RecurringKind, RecurringRule } from "@/types/domain";
import type { createRecurringSchema, updateRecurringSchema } from "@/lib/schemas";

type CreateRecurring = z.infer<typeof createRecurringSchema>;
/** `endDate: null` clears the end date. */
type UpdateRecurring = Omit<z.infer<typeof updateRecurringSchema>, "endDate"> & {
  endDate?: string | null;
};

/** Most occurrences one rule may catch up on in a single run. */
const MAX_CATCH_UP = 24;

export interface PendingOccurrence {
  ruleId: string;
  name: string;
  kind: RecurringKind;
  amount: number;
  date: string;
}

export interface RunDueResult {
  posted: number;
  pending: PendingOccurrence[];
}

// ---------------------------------------------------------------------------
// Concurrency guard
// ---------------------------------------------------------------------------

/**
 * Per-spreadsheet promise chain. Every operation that posts occurrences or
 * moves `nextDate` runs through it, so two concurrent requests in the same
 * server instance (e.g. two tabs opening at once) can never post the same
 * occurrence twice: the second waits, re-reads the rule and finds it handled.
 */
const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(spreadsheetId: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(spreadsheetId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  locks.set(spreadsheetId, run);
  try {
    return await run;
  } finally {
    if (locks.get(spreadsheetId) === run) locks.delete(spreadsheetId);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * "Today" for schedule decisions. The client sends its local date (the user's
 * timezone); accept it when it is within a day of the server's UTC date,
 * otherwise fall back to the server date.
 */
export function resolveToday(clientToday?: string): string {
  const server = new Date().toISOString().slice(0, 10);
  if (
    clientToday &&
    /^\d{4}-\d{2}-\d{2}$/.test(clientToday) &&
    clientToday >= addDays(server, -1) &&
    clientToday <= addDays(server, 1)
  ) {
    return clientToday;
  }
  return server;
}

/** Drop fields that do not apply to the rule's kind. */
function normalise(rule: RecurringRule): RecurringRule {
  if (rule.kind === "transfer") {
    return { ...rule, categoryId: undefined, paymentMethod: undefined };
  }
  if (rule.kind === "income") {
    return { ...rule, toAccountId: undefined, paymentMethod: undefined };
  }
  return { ...rule, toAccountId: undefined, paymentMethod: rule.paymentMethod ?? "cash" };
}

async function assertReferences(
  spreadsheetId: string,
  rule: RecurringRule,
): Promise<void> {
  const [accounts, categories] = await Promise.all([
    accountsRepo.list(spreadsheetId),
    rule.kind === "transfer" ? Promise.resolve([]) : categoriesRepo.list(spreadsheetId),
  ]);
  const accountIds = [rule.accountId, rule.toAccountId].filter(
    (id): id is string => Boolean(id),
  );
  for (const id of accountIds) {
    if (!accounts.some((a) => a.id === id)) {
      throw AppError.validation("Account not found.");
    }
  }
  if (rule.kind !== "transfer") {
    const category = categories.find((c) => c.id === rule.categoryId);
    if (!category || category.kind !== rule.kind) {
      throw AppError.validation("Category not found.");
    }
  }
}

async function getRule(spreadsheetId: string, id: string): Promise<RecurringRule> {
  const rule = await recurringRepo.findById(spreadsheetId, id);
  if (!rule) throw AppError.notFound("Recurring rule not found.");
  return rule;
}

/** `nextDate` after handling `date`, deactivating the rule once it ends. */
function advancedPatch(
  rule: RecurringRule,
  date: string,
): Pick<RecurringRule, "nextDate" | "isActive"> {
  const nextDate = nextOccurrence(rule, date);
  return { nextDate, isActive: rule.isActive && withinEnd(rule, nextDate) };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** All rules, soonest due first (paused rules last). */
export async function listRecurring(): Promise<RecurringRule[]> {
  const spreadsheetId = await getSpreadsheetId();
  const rules = await recurringRepo.list(spreadsheetId);
  return rules.sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      a.nextDate.localeCompare(b.nextDate) ||
      a.name.localeCompare(b.name),
  );
}

export async function createRecurring(input: CreateRecurring): Promise<RecurringRule> {
  const spreadsheetId = await getSpreadsheetId();
  const rule = normalise({
    id: generateId(),
    kind: input.kind,
    name: input.name,
    amount: input.amount,
    categoryId: input.categoryId || undefined,
    accountId: input.accountId,
    toAccountId: input.toAccountId || undefined,
    paymentMethod: input.paymentMethod,
    frequency: input.frequency,
    interval: input.interval,
    startDate: input.startDate,
    endDate: input.endDate || undefined,
    nextDate: input.startDate,
    autoPost: input.autoPost,
    isActive: input.isActive,
    notes: input.notes || undefined,
    createdAt: new Date().toISOString(),
  });
  await assertReferences(spreadsheetId, rule);
  return recurringRepo.create(spreadsheetId, rule);
}

/**
 * Update a rule. When the schedule (start, frequency, interval) changes the
 * next date is recomputed as the first occurrence on the new schedule that is
 * on/after today — but never before the old next date, so nothing already
 * posted can come due again. Resuming a paused rule skips the occurrences
 * missed while it was paused instead of back-posting them.
 */
export async function updateRecurring(
  id: string,
  input: UpdateRecurring,
  today: string,
): Promise<RecurringRule> {
  const spreadsheetId = await getSpreadsheetId();
  return withLock(spreadsheetId, async () => {
    const current = await getRule(spreadsheetId, id);
    const merged: RecurringRule = normalise({
      ...current,
      ...input,
      id,
      endDate:
        "endDate" in input ? input.endDate || undefined : current.endDate,
      notes: "notes" in input ? input.notes || undefined : current.notes,
    });

    if (merged.kind !== "transfer" && !merged.categoryId) {
      throw AppError.validation("Select a category.");
    }
    if (merged.kind === "transfer") {
      if (!merged.toAccountId) throw AppError.validation("Select an account.");
      if (merged.toAccountId === merged.accountId) {
        throw AppError.validation("Choose two different accounts.");
      }
    }
    if (merged.endDate && merged.endDate < merged.startDate) {
      throw AppError.validation("End date must be after the start date.");
    }
    await assertReferences(spreadsheetId, merged);

    const scheduleChanged =
      merged.startDate !== current.startDate ||
      merged.frequency !== current.frequency ||
      merged.interval !== current.interval;
    const floor = current.nextDate > today ? current.nextDate : today;

    if (scheduleChanged) {
      merged.nextDate = firstOccurrenceOnOrAfter(merged, floor);
    } else if (merged.isActive && !current.isActive && merged.nextDate < today) {
      let next = merged.nextDate;
      for (let i = 0; next < today && i < 50_000; i += 1) {
        next = nextOccurrence(merged, next);
      }
      merged.nextDate = next;
    }
    // Re-activating a rule whose schedule has already finished is pointless.
    if (merged.isActive && !withinEnd(merged, merged.nextDate) && !current.isActive) {
      throw AppError.validation("This schedule has already ended.");
    }

    return recurringRepo.update(spreadsheetId, id, merged);
  });
}

export async function deleteRecurring(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await withLock(spreadsheetId, () => recurringRepo.remove(spreadsheetId, id));
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

/** Create the expense / income / transfer for one occurrence of a rule. */
export async function postOccurrence(
  rule: RecurringRule,
  date: string,
  amount: number = rule.amount,
): Promise<void> {
  const notes = [`${rule.name} (recurring)`, rule.notes]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 500);

  switch (rule.kind) {
    case "expense":
      if (!rule.categoryId) throw AppError.validation("Select a category.");
      await createExpense({
        date,
        amount,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        paymentMethod: rule.paymentMethod ?? "cash",
        notes,
      });
      return;
    case "income":
      if (!rule.categoryId) throw AppError.validation("Select a category.");
      await createIncome({
        date,
        amount,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        notes,
      });
      return;
    case "transfer":
      if (!rule.toAccountId) throw AppError.validation("Select an account.");
      await createTransfer({
        date,
        amount,
        fromAccountId: rule.accountId,
        toAccountId: rule.toAccountId,
        notes,
      });
      return;
  }
}

/**
 * Post every due occurrence of active auto-post rules (catching up on missed
 * ones, capped per rule) and advance their next date. Rules past their end
 * date are deactivated. Due occurrences of confirm-first rules are returned
 * as `pending` (earliest per rule) and are not posted.
 */
export async function runDueRules(today: string): Promise<RunDueResult> {
  const spreadsheetId = await getSpreadsheetId();
  return withLock(spreadsheetId, async () => {
    const rules = await recurringRepo.list(spreadsheetId);
    let posted = 0;
    const pending: PendingOccurrence[] = [];

    for (const rule of rules) {
      if (!rule.isActive || !rule.nextDate) continue;

      if (!withinEnd(rule, rule.nextDate)) {
        await recurringRepo.update(spreadsheetId, rule.id, { isActive: false });
        continue;
      }

      const due = occurrencesDue(rule, today, MAX_CATCH_UP);
      const earliest = due[0];
      if (!earliest) continue;

      if (!rule.autoPost) {
        pending.push({
          ruleId: rule.id,
          name: rule.name,
          kind: rule.kind,
          amount: rule.amount,
          date: earliest,
        });
        continue;
      }

      // Advance past whatever was posted even if a later post fails, so a
      // retry never duplicates the successful ones.
      let lastPosted: string | undefined;
      try {
        for (const date of due) {
          await postOccurrence(rule, date);
          lastPosted = date;
          posted += 1;
        }
      } catch (error) {
        console.error(`[recurring] failed to post rule ${rule.id}`, error);
      } finally {
        if (lastPosted) {
          await recurringRepo.update(
            spreadsheetId,
            rule.id,
            advancedPatch(rule, lastPosted),
          );
        }
      }
    }

    pending.sort((a, b) => a.date.localeCompare(b.date));
    return { posted, pending };
  });
}

/**
 * Post the rule's next occurrence now (optionally with a different amount,
 * e.g. a utility bill that varies) and advance its next date. `date` must be
 * the rule's current next date, which rejects a stale second confirmation.
 * The transaction is dated on the due date, or today when posted early.
 */
export async function confirmOccurrence(
  ruleId: string,
  input: { date: string; amount?: number },
  today: string,
): Promise<RecurringRule> {
  const spreadsheetId = await getSpreadsheetId();
  return withLock(spreadsheetId, async () => {
    const rule = await getRule(spreadsheetId, ruleId);
    if (rule.nextDate !== input.date) {
      throw new AppError("CONFLICT", "This occurrence was already handled.");
    }
    if (!withinEnd(rule, rule.nextDate)) {
      throw AppError.validation("This schedule has already ended.");
    }
    const postDate = input.date > today ? today : input.date;
    await postOccurrence(rule, postDate, input.amount ?? rule.amount);
    return recurringRepo.update(spreadsheetId, ruleId, advancedPatch(rule, rule.nextDate));
  });
}

/** Skip the rule's next occurrence without posting anything. */
export async function skipOccurrence(
  ruleId: string,
  input: { date?: string } = {},
): Promise<RecurringRule> {
  const spreadsheetId = await getSpreadsheetId();
  return withLock(spreadsheetId, async () => {
    const rule = await getRule(spreadsheetId, ruleId);
    if (input.date && rule.nextDate !== input.date) {
      throw new AppError("CONFLICT", "This occurrence was already handled.");
    }
    return recurringRepo.update(spreadsheetId, ruleId, advancedPatch(rule, rule.nextDate));
  });
}
