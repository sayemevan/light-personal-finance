"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Income } from "@/types/domain";
import type { CreateIncomeInput } from "@/lib/schemas";

const INVALIDATE = [queryKeys.income, ...derivedKeys] as const;

export function useIncome() {
  return useQuery({
    queryKey: queryKeys.income,
    queryFn: () => api.get<Income[]>("/api/income"),
  });
}

export function useCreateIncome() {
  return useCrudMutation(
    (input: CreateIncomeInput) => api.post<Income>("/api/income", input),
    { successMessage: "Income added.", invalidate: INVALIDATE },
  );
}

export function useUpdateIncome() {
  return useCrudMutation(
    ({ id, input }: { id: string; input: Partial<CreateIncomeInput> }) =>
      api.patch<Income>(`/api/income/${id}`, input),
    { successMessage: "Income updated.", invalidate: INVALIDATE },
  );
}

export function useDeleteIncome() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/income/${id}`),
    { successMessage: "Income deleted.", invalidate: INVALIDATE },
  );
}
