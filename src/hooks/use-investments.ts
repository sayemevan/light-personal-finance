"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Investment } from "@/types/domain";
import type { CreateInvestmentInput } from "@/lib/schemas";

const INVALIDATE = [queryKeys.investments, ...derivedKeys] as const;

export function useInvestments() {
  return useQuery({
    queryKey: queryKeys.investments,
    queryFn: () => api.get<Investment[]>("/api/investments"),
  });
}

export function useCreateInvestment() {
  return useCrudMutation(
    (input: CreateInvestmentInput) =>
      api.post<Investment>("/api/investments", input),
    { successMessage: "Investment added.", invalidate: INVALIDATE },
  );
}

export function useUpdateInvestment() {
  return useCrudMutation(
    ({ id, input }: { id: string; input: Partial<CreateInvestmentInput> }) =>
      api.patch<Investment>(`/api/investments/${id}`, input),
    { successMessage: "Investment updated.", invalidate: INVALIDATE },
  );
}

export function useDeleteInvestment() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/investments/${id}`),
    { successMessage: "Investment deleted.", invalidate: INVALIDATE },
  );
}
