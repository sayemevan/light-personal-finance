"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Goal, GoalContribution } from "@/types/domain";
import type {
  CreateGoalContributionInput,
  CreateGoalInput,
} from "@/lib/schemas";

const INVALIDATE = [queryKeys.goals, ...derivedKeys] as const;

export type GoalWithContributions = Goal & {
  contributions: GoalContribution[];
};

/**
 * Goal update payload. `targetDate: ""` clears the date and `accountId: ""`
 * unlinks the account.
 */
export type GoalUpdate = Partial<CreateGoalInput> & { isArchived?: boolean };

export function useGoals() {
  return useQuery({
    queryKey: queryKeys.goals,
    queryFn: () => api.get<Goal[]>("/api/goals"),
  });
}

export function useGoal(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.goal(id) : ["goals", "none"],
    queryFn: () => api.get<GoalWithContributions>(`/api/goals/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateGoal() {
  return useCrudMutation(
    (input: CreateGoalInput) => api.post<Goal>("/api/goals", input),
    { successMessage: "Goal added.", invalidate: INVALIDATE },
  );
}

export function useUpdateGoal() {
  return useCrudMutation(
    ({ id, input }: { id: string; input: GoalUpdate }) =>
      api.patch<Goal>(`/api/goals/${id}`, input),
    { successMessage: "Goal updated.", invalidate: INVALIDATE },
  );
}

export function useDeleteGoal() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/goals/${id}`),
    { successMessage: "Goal deleted.", invalidate: INVALIDATE },
  );
}

export function useAddGoalContribution() {
  return useCrudMutation(
    (input: CreateGoalContributionInput) =>
      api.post<GoalContribution>(
        `/api/goals/${input.goalId}/contributions`,
        input,
      ),
    {
      successMessage: (data) =>
        data.amount < 0 ? "Withdrawal recorded." : "Money added.",
      invalidate: INVALIDATE,
    },
  );
}

export function useDeleteGoalContribution() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/goal-contributions/${id}`),
    { successMessage: "Entry removed.", invalidate: INVALIDATE },
  );
}
