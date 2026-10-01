"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/recurring";
import type { RecurringRule } from "@/types/domain";
import type { CreateRecurringInput } from "@/lib/schemas";

/** Posting an occurrence touches transactions and every derived view. */
export const RECURRING_INVALIDATE = [
  queryKeys.recurring,
  queryKeys.expenses,
  queryKeys.income,
  queryKeys.transfers,
  ...derivedKeys,
] as const;

const RULES_ONLY = [queryKeys.recurring] as const;

export interface RecurringRunResult {
  posted: number;
  pending: {
    ruleId: string;
    name: string;
    kind: RecurringRule["kind"];
    amount: number;
    date: string;
  }[];
}

/** PATCH body: `endDate: null` clears the end date. */
export type UpdateRecurringInput = Omit<
  Partial<CreateRecurringInput>,
  "endDate"
> & { endDate?: string | null };

export function useRecurring() {
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: () => api.get<RecurringRule[]>("/api/recurring"),
  });
}

/**
 * Create a rule. An auto-post rule that is already due (start date today or
 * earlier) is posted straight away instead of waiting for the next session.
 */
export function useCreateRecurring() {
  return useCrudMutation(
    async (input: CreateRecurringInput) => {
      const created = await api.post<RecurringRule>("/api/recurring", input);
      if (created.autoPost && created.isActive && created.nextDate <= todayISO()) {
        const { posted } = await runRecurring().catch(() => ({ posted: 0 }));
        return { rule: created, posted };
      }
      return { rule: created, posted: 0 };
    },
    {
      successMessage: ({ posted }) =>
        posted > 0
          ? `Recurring transaction added. ${posted} due ${
              posted === 1 ? "entry was" : "entries were"
            } recorded.`
          : "Recurring transaction added.",
      invalidate: RECURRING_INVALIDATE,
    },
  );
}

export function useUpdateRecurring() {
  return useCrudMutation(
    ({ id, input }: { id: string; input: UpdateRecurringInput }) =>
      api.patch<RecurringRule>(`/api/recurring/${id}`, {
        ...input,
        today: todayISO(),
      }),
    { successMessage: "Recurring transaction updated.", invalidate: RULES_ONLY },
  );
}

export function useToggleRecurring() {
  return useCrudMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<RecurringRule>(`/api/recurring/${id}`, {
        isActive,
        today: todayISO(),
      }),
    {
      successMessage: (rule) =>
        rule.isActive ? `${rule.name} resumed.` : `${rule.name} paused.`,
      invalidate: RULES_ONLY,
    },
  );
}

export function useDeleteRecurring() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/recurring/${id}`),
    { successMessage: "Recurring transaction deleted.", invalidate: RULES_ONLY },
  );
}

/** Post the rule's next occurrence now, optionally with a different amount. */
export function useConfirmOccurrence() {
  return useCrudMutation(
    ({ id, date, amount }: { id: string; date: string; amount?: number }) =>
      api.post<RecurringRule>(`/api/recurring/${id}/confirm`, {
        date,
        amount,
        today: todayISO(),
      }),
    {
      successMessage: (rule) => `${rule.name} added.`,
      invalidate: RECURRING_INVALIDATE,
    },
  );
}

/** Advance past the rule's next occurrence without posting it. */
export function useSkipOccurrence() {
  return useCrudMutation(
    ({ id, date }: { id: string; date?: string }) =>
      api.post<RecurringRule>(`/api/recurring/${id}/skip`, { date }),
    {
      successMessage: (rule) =>
        rule.isActive
          ? `Skipped. ${rule.name} is next due ${formatDate(rule.nextDate)}.`
          : `Skipped. ${rule.name} has no more occurrences.`,
      invalidate: RULES_ONLY,
    },
  );
}

/** Run due rules; used by the background runner. */
export function runRecurring(): Promise<RecurringRunResult> {
  return api.post<RecurringRunResult>("/api/recurring/run", {
    today: todayISO(),
  });
}
