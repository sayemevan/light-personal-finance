"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Budget, BudgetStatus } from "@/types/domain";
import type { CreateBudgetInput } from "@/lib/schemas";

const INVALIDATE = [queryKeys.budgets, ...derivedKeys] as const;

/** Budgets with their usage for `month` ("YYYY-MM"). */
export function useBudgets(month: string) {
  return useQuery({
    queryKey: [...queryKeys.budgets, month],
    queryFn: () =>
      api.get<BudgetStatus[]>(
        `/api/budgets?month=${encodeURIComponent(month)}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useCreateBudget() {
  return useCrudMutation(
    (input: CreateBudgetInput) => api.post<Budget>("/api/budgets", input),
    { successMessage: "Budget added.", invalidate: INVALIDATE },
  );
}

export function useUpdateBudget() {
  return useCrudMutation(
    ({ id, input }: { id: string; input: Partial<CreateBudgetInput> }) =>
      api.patch<Budget>(`/api/budgets/${id}`, input),
    { successMessage: "Budget updated.", invalidate: INVALIDATE },
  );
}

export function useDeleteBudget() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/budgets/${id}`),
    { successMessage: "Budget deleted.", invalidate: INVALIDATE },
  );
}
