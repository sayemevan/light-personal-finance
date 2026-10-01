import { z } from "zod";

import { tagsSchema } from "@/lib/schemas";

/** Input contracts for CSV statement import. */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");

/** Most rows one import request may write. */
export const MAX_IMPORT_ROWS = 2000;

export const importCheckSchema = z
  .object({
    accountId: z.string().min(1),
    from: isoDate,
    to: isoDate,
  })
  .refine((value) => value.from <= value.to, {
    message: "`from` must not be after `to`",
    path: ["to"],
  });
export type ImportCheckInput = z.infer<typeof importCheckSchema>;

const importRowSchema = z.object({
  date: isoDate,
  amount: z.coerce.number().finite().positive("Amount must be positive"),
  categoryId: z.string().min(1),
  merchant: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
  tags: tagsSchema,
});
export type ImportRowInput = z.infer<typeof importRowSchema>;

export const importTransactionsSchema = z
  .object({
    accountId: z.string().min(1),
    expenses: z.array(importRowSchema).max(MAX_IMPORT_ROWS).default([]),
    income: z.array(importRowSchema).max(MAX_IMPORT_ROWS).default([]),
  })
  .refine(
    (value) => value.expenses.length + value.income.length <= MAX_IMPORT_ROWS,
    { message: `At most ${MAX_IMPORT_ROWS} rows per import`, path: ["expenses"] },
  )
  .refine((value) => value.expenses.length + value.income.length > 0, {
    message: "Nothing to import",
    path: ["expenses"],
  });
export type ImportTransactionsInput = z.input<typeof importTransactionsSchema>;
export type ImportTransactionsData = z.output<typeof importTransactionsSchema>;

/** One existing transaction returned for duplicate detection. */
export interface ImportExistingRow {
  id: string;
  kind: "expense" | "income";
  date: string;
  amount: number;
  categoryId: string;
  merchant?: string;
  notes?: string;
}

export interface ImportCheckResult {
  existing: ImportExistingRow[];
  /** Lower-cased merchant → most recently used expense category id. */
  merchantCategories: Record<string, string>;
}

export interface ImportResult {
  expenses: number;
  income: number;
}
