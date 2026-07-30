"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Expense } from "@/types/domain";
import type { CreateExpenseInput } from "@/lib/schemas";

const INVALIDATE = [queryKeys.expenses, ...derivedKeys] as const;

export function useExpenses() {
  return useQuery({
    queryKey: queryKeys.expenses,
    queryFn: () => api.get<Expense[]>("/api/expenses"),
  });
}

export function useCreateExpense() {
  return useCrudMutation(
    (input: CreateExpenseInput) => api.post<Expense>("/api/expenses", input),
    { successMessage: "Expense added.", invalidate: INVALIDATE },
  );
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
