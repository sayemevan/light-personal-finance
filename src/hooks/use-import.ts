"use client";

import { useMutation } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type {
  ImportCheckInput,
  ImportCheckResult,
  ImportResult,
  ImportTransactionsInput,
} from "@/lib/schemas/import";

// Imports can add merchants/tags (suggestions) and new years (year filter).
const INVALIDATE = [
  queryKeys.expenses,
  queryKeys.income,
  queryKeys.suggestions,
  queryKeys.archiveYears,
  ...derivedKeys,
] as const;

/** Existing rows + merchant categories for duplicate detection. */
export function useImportCheck() {
  return useMutation({
    mutationFn: (input: ImportCheckInput) =>
      api.post<ImportCheckResult>("/api/import/check", input),
  });
}

export function useImportTransactions() {
  return useCrudMutation(
    (input: ImportTransactionsInput) =>
      api.post<ImportResult>("/api/import", input),
    {
      successMessage: (data) =>
        `Imported ${data.expenses + data.income} transaction${
          data.expenses + data.income === 1 ? "" : "s"
        }.`,
      invalidate: INVALIDATE,
    },
  );
}
