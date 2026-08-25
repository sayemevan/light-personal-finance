"use client";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { ArchiveKindInput } from "@/lib/schemas";
import type { ArchiveResult } from "@/types/api";
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

function archiveSuccessMessage(result: ArchiveResult): string {
  const label = result.kind === "expense" ? "Expenses" : "Income";
  if (result.archivedCount === 0) {
    return `No ${result.kind} details to archive.`;
  }
  const years = result.years
    .map(
      (year) =>
        `${year.year} (${year.total.toLocaleString()} across ${year.rowCount} rows)`,
    )
    .join("; ");
  return `Archived ${label}: ${years}.`;
}

/** Copy live expense or income details into the Drive archive spreadsheet. */
export function useArchiveTransactions() {
  return useCrudMutation<ArchiveKindInput, ArchiveResult>(
    (input) => api.post<ArchiveResult>("/api/archive", input),
    {
      successMessage: archiveSuccessMessage,
      invalidate: [
        queryKeys.expenses,
        queryKeys.income,
        queryKeys.archiveYears,
        ...derivedKeys,
      ],
    },
  );
}
