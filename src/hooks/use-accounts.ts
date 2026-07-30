"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Account } from "@/types/domain";
import type { CreateAccountInput } from "@/lib/schemas";

const INVALIDATE = [queryKeys.accounts, ...derivedKeys] as const;

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => api.get<Account[]>("/api/accounts"),
  });
}

export function useCreateAccount() {
  return useCrudMutation(
    (input: CreateAccountInput) => api.post<Account>("/api/accounts", input),
    { successMessage: "Account created.", invalidate: INVALIDATE },
  );
}

export function useUpdateAccount() {
  return useCrudMutation(
    ({
      id,
      input,
    }: {
      id: string;
      input: Partial<CreateAccountInput> & { isArchived?: boolean };
    }) => api.patch<Account>(`/api/accounts/${id}`, input),
    { successMessage: "Account updated.", invalidate: INVALIDATE },
  );
}

export function useDeleteAccount() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/accounts/${id}`),
    { successMessage: "Account deleted.", invalidate: INVALIDATE },
  );
}
