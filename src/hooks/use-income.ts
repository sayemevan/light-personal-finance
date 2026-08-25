"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { buildListQuery, type ListQueryParams } from "@/hooks/list-params";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Income } from "@/types/domain";
import type { Paginated } from "@/types/api";
import type { CreateIncomeInput } from "@/lib/schemas";

const INVALIDATE = [queryKeys.income, ...derivedKeys] as const;

export function useIncome(params: ListQueryParams) {
  return useQuery({
    queryKey: [...queryKeys.income, params],
    queryFn: () =>
      api.get<Paginated<Income>>(`/api/income?${buildListQuery(params)}`),
    placeholderData: keepPreviousData,
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
