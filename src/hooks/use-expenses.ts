"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { buildListQuery, type ListQueryParams } from "@/hooks/list-params";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Expense } from "@/types/domain";
import type { Paginated } from "@/types/api";
import type {
  CreateExpenseInput,
  CreateExpenseWithSplitInput,
} from "@/lib/schemas";
import type { EntrySuggestions } from "@/lib/services/expense.service";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";

/** Budget usage warning returned when a new expense pushes a budget ≥ 80%. */
export interface BudgetAlert {
  categoryName: string;
  spent: number;
  limit: number;
  level: "warning" | "exceeded";
}

export type CreatedExpense = Expense & {
  splitLoans?: number;
  budgetAlert?: BudgetAlert | null;
};

const INVALIDATE = [queryKeys.expenses, ...derivedKeys] as const;

export function useExpenses(params: ListQueryParams) {
  return useQuery({
    queryKey: [...queryKeys.expenses, params],
    queryFn: () =>
      api.get<Paginated<Expense>>(`/api/expenses?${buildListQuery(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateExpense() {
  return useCrudMutation(
    (input: CreateExpenseWithSplitInput) =>
      api.post<CreatedExpense>("/api/expenses", input),
    {
      successMessage: (created) =>
        created.splitLoans
          ? `Expense added. ${created.splitLoans} ${created.splitLoans === 1 ? "person owes" : "people owe"} you their share (see Loans).`
          : "Expense added.",
      invalidate: [...INVALIDATE, queryKeys.loans, queryKeys.suggestions],
    },
  );
}

/** Merchant + tag autocomplete for the expense form. */
export function useEntrySuggestions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.suggestions,
    queryFn: () => api.get<EntrySuggestions>("/api/expenses/suggestions"),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useDeleteExpenseWithUndo() {
  return useUndoableDelete({
    listKey: queryKeys.expenses,
    endpoint: "/api/expenses",
    invalidate: INVALIDATE,
  });
}

export function useUpdateExpense() {
  return useCrudMutation(
    ({ id, input }: { id: string; input: Partial<CreateExpenseInput> }) =>
      api.patch<Expense>(`/api/expenses/${id}`, input),
    { successMessage: "Expense updated.", invalidate: INVALIDATE },
  );
}

export function useDeleteExpense() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/expenses/${id}`),
    { successMessage: "Expense deleted.", invalidate: INVALIDATE },
  );
}
