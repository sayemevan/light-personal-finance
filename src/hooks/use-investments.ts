"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Investment, InvestmentTransaction } from "@/types/domain";
import type {
  CreateInvestmentInput,
  CreateInvestmentTransactionInput,
} from "@/lib/schemas";

const INVALIDATE = [queryKeys.investments, ...derivedKeys] as const;

export type InvestmentWithTransactions = Investment & {
  transactions: InvestmentTransaction[];
};

export function useInvestments() {
  return useQuery({
    queryKey: queryKeys.investments,
    queryFn: () => api.get<Investment[]>("/api/investments"),
  });
}

export function useInvestment(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.investment(id) : ["investments", "none"],
    queryFn: () =>
      api.get<InvestmentWithTransactions>(`/api/investments/${id}`),
    enabled: Boolean(id),
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

export function useAddInvestmentTransaction() {
  return useCrudMutation(
    (input: CreateInvestmentTransactionInput) =>
      api.post<InvestmentTransaction>("/api/investment-transactions", input),
    { successMessage: "Entry recorded.", invalidate: INVALIDATE },
  );
}

export function useDeleteInvestmentTransaction() {
  return useCrudMutation(
    (id: string) =>
      api.delete<{ id: string }>(`/api/investment-transactions/${id}`),
    { successMessage: "Entry removed.", invalidate: INVALIDATE },
  );
}
