"use client";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { FinanceWorkspace } from "@/lib/services/bootstrap.service";

/** Manually (re)verify the Google Drive workspace and spreadsheet. */
export function useVerifyWorkspace() {
  return useCrudMutation<void, FinanceWorkspace>(
    () => api.post<FinanceWorkspace>("/api/bootstrap", {}),
    {
    successMessage: "Workspace verified.",
    invalidate: [
      queryKeys.expenses,
      queryKeys.income,
      queryKeys.categories,
      ...derivedKeys,
    ],
    },
  );
}
