/**
 * Pure logic behind the statement-import wizard: column guessing, saved
 * mappings, row parsing, duplicate detection and category suggestions.
 */

import {
  detectDateFormat,
  parseAmount,
  parseDate,
  type DateFormat,
} from "@/lib/csv";
import type {
  ImportCheckResult,
  ImportExistingRow,
} from "@/lib/schemas/import";

/** Select value meaning "no column". */
export const NONE = "__none__";

export type AmountMode = "signed" | "split";
export type SignConvention = "negative_expense" | "positive_expense";
export type RowKind = "expense" | "income";

export interface ColumnMapping {
  date: string;
  description: string;
  notes: string;
  amountMode: AmountMode;
  amount: string;
  sign: SignConvention;
  debit: string;
  credit: string;
  dateFormat: DateFormat;
  accountId: string;
  expenseCategoryId: string;
  incomeCategoryId: string;
}

export function emptyMapping(): ColumnMapping {
  return {
    date: NONE,
    description: NONE,
    notes: NONE,
    amountMode: "signed",
    amount: NONE,
    sign: "negative_expense",
    debit: NONE,
    credit: NONE,
    dateFormat: "DD/MM/YYYY",
    accountId: "",
    expenseCategoryId: "",
    incomeCategoryId: "",
  };
}

const PATTERNS: Record<
  "date" | "description" | "notes" | "amount" | "debit" | "credit",
  RegExp[]
> = {
  date: [/^(txn|transaction|trans|posting|post|value|booking)?\s*\.?\s*date$/i, /date/i],
  description: [
    /^(description|details|narration|particulars|merchant|payee)$/i,
    /desc|detail|narration|particular|merchant|payee|remark|transaction details/i,
  ],
  notes: [/^(notes?|memo|reference|ref\.?( no\.?)?|remarks?)$/i, /reference|memo|note/i],
  amount: [/^(amount|amt|transaction amount|txn amount)$/i, /amount/i],
  debit: [/^(debit|withdrawal|withdrawals|dr|money out|paid out|out)$/i, /debit|withdraw|money out|paid out/i],
  credit: [/^(credit|deposit|deposits|cr|money in|paid in|in)$/i, /credit|deposit|money in|paid in/i],
};

/** Guess column indexes from header names. */
export function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const taken = new Set<number>();
  const find = (key: keyof typeof PATTERNS, exclude?: RegExp): string => {
    for (const pattern of PATTERNS[key]) {
      const index = headers.findIndex(
        (header, i) =>
          !taken.has(i) &&
          pattern.test(header.trim()) &&
          !(exclude && exclude.test(header)),
      );
      if (index >= 0) {
        taken.add(index);
        return String(index);
      }
    }
    return NONE;
  };

  const date = find("date");
  const debit = find("debit", /balance/i);
  const credit = find("credit", /balance|card/i);
  const amount = find("amount", /balance/i);
  const description = find("description");
  const notes = find("notes");
  // Prefer one signed amount column; fall back to debit/credit columns.
  const split = amount === NONE && (debit !== NONE || credit !== NONE);
  return {
    date,
    description,
    notes,
    debit,
    credit,
    amount,
    amountMode: split ? "split" : "signed",
  };
}

export function headerSignature(headers: string[]): string {
  return headers.map((header) => header.trim().toLowerCase()).join("|");
}

const STORAGE_KEY = "pf.import.mappings.v1";

export function loadSavedMapping(signature: string): ColumnMapping | null {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      ColumnMapping
    >;
    return all[signature] ?? null;
  } catch {
    return null;
  }
}

export function saveMapping(signature: string, mapping: ColumnMapping): void {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      ColumnMapping
    >;
    all[signature] = mapping;
    // Keep the store small: the 20 most recent signatures.
    const entries = Object.entries(all).slice(-20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Storage unavailable (private mode etc.) — mapping just isn't remembered.
  }
}

export function detectFormatFor(rows: string[][], column: string): DateFormat {
  if (column === NONE) return "DD/MM/YYYY";
  const index = Number(column);
  return detectDateFormat(rows.slice(0, 50).map((row) => row[index] ?? ""));
}

/** Validation message for step 2, or null when the mapping is usable. */
export function mappingProblem(mapping: ColumnMapping): string | null {
  if (mapping.date === NONE) return "Choose the date column.";
  if (mapping.amountMode === "signed" && mapping.amount === NONE) {
    return "Choose the amount column.";
  }
  if (
    mapping.amountMode === "split" &&
    mapping.debit === NONE &&
    mapping.credit === NONE
  ) {
    return "Choose the debit and/or credit column.";
  }
  if (!mapping.accountId) return "Choose the account this statement is for.";
  if (!mapping.expenseCategoryId) return "Choose a default expense category.";
  if (!mapping.incomeCategoryId) return "Choose a default income category.";
  return null;
}

export interface ParsedRow {
  /** Index within the data rows (stable key). */
  index: number;
  date?: string;
  description: string;
  notes?: string;
  /** Always positive. */
  amount: number;
  kind: RowKind;
  error?: string;
}

const cellAt = (row: string[], column: string) =>
  column === NONE ? "" : (row[Number(column)] ?? "").trim();

export function parseRows(
  dataRows: string[][],
  mapping: ColumnMapping,
): ParsedRow[] {
  return dataRows.map((row, index) => {
    const description = cellAt(row, mapping.description).replace(/\s+/g, " ");
    const notes = cellAt(row, mapping.notes).replace(/\s+/g, " ") || undefined;
    const base = { index, description, notes, amount: 0, kind: "expense" as RowKind };

    const rawDate = cellAt(row, mapping.date);
    const date = parseDate(rawDate, mapping.dateFormat);

    let amount = 0;
    let kind: RowKind = "expense";
    let amountError: string | undefined;
    if (mapping.amountMode === "signed") {
      const value = parseAmount(cellAt(row, mapping.amount));
      if (value == null) amountError = "No amount";
      else if (value === 0) amountError = "Zero amount";
      else {
        amount = Math.abs(value);
        const negative = value < 0;
        kind =
          negative === (mapping.sign === "negative_expense") ? "expense" : "income";
      }
    } else {
      const debit = Math.abs(parseAmount(cellAt(row, mapping.debit)) ?? 0);
      const credit = Math.abs(parseAmount(cellAt(row, mapping.credit)) ?? 0);
      if (debit > 0 && credit > 0) amountError = "Both debit and credit set";
      else if (debit > 0) {
        amount = debit;
        kind = "expense";
      } else if (credit > 0) {
        amount = credit;
        kind = "income";
      } else amountError = "No amount";
    }

    const error = !date
      ? rawDate
        ? `Unrecognised date "${rawDate.slice(0, 24)}"`
        : "No date"
      : amountError;

    return {
      ...base,
      date: date ?? undefined,
      amount: Math.round(amount * 100) / 100,
      kind,
      error,
    };
  });
}

function normalize(text: string | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Loose description match: either empty, containment, or ≥50% shared words. */
export function similarDescription(a?: string, b?: string): boolean {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const leftWords = new Set(left.split(" "));
  const rightWords = new Set(right.split(" "));
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / Math.min(leftWords.size, rightWords.size) >= 0.5;
}

export type DuplicateReason = "existing" | "file";

/**
 * Flag rows that match an existing transaction (same kind, date, amount and a
 * similar description), each existing row matching at most once, and rows
 * repeating an earlier row in the same file.
 */
export function findDuplicates(
  rows: ParsedRow[],
  existing: ImportExistingRow[],
): Map<number, DuplicateReason> {
  const result = new Map<number, DuplicateReason>();
  const used = new Set<string>();
  const pool = new Map<string, ImportExistingRow[]>();
  for (const row of existing) {
    const key = `${row.kind}|${row.date}|${row.amount.toFixed(2)}`;
    pool.set(key, [...(pool.get(key) ?? []), row]);
  }
  const seenInFile = new Set<string>();

  for (const row of rows) {
    if (row.error || !row.date) continue;
    const key = `${row.kind}|${row.date}|${row.amount.toFixed(2)}`;
    const candidates = pool.get(key) ?? [];
    const match = candidates.find(
      (candidate) =>
        !used.has(candidate.id) &&
        similarDescription(
          row.description || row.notes,
          candidate.merchant || candidate.notes,
        ),
    );
    if (match) {
      used.add(match.id);
      result.set(row.index, "existing");
      continue;
    }
    const fileKey = `${key}|${normalize(row.description)}|${normalize(row.notes)}`;
    if (seenInFile.has(fileKey)) result.set(row.index, "file");
    else seenInFile.add(fileKey);
  }
  return result;
}

/** Suggested category: same merchant's last expense category, else default. */
export function suggestCategory(
  row: ParsedRow,
  mapping: ColumnMapping,
  check: ImportCheckResult | undefined,
  validExpenseCategories: Set<string>,
): string {
  if (row.kind === "income") return mapping.incomeCategoryId;
  const merchant = row.description.trim().toLowerCase();
  const suggested = merchant ? check?.merchantCategories[merchant] : undefined;
  return suggested && validExpenseCategories.has(suggested)
    ? suggested
    : mapping.expenseCategoryId;
}

/** Inclusive date range covered by the parsed rows. */
export function dateRange(rows: ParsedRow[]): { from: string; to: string } | null {
  const dates = rows
    .map((row) => row.date)
    .filter((date): date is string => Boolean(date))
    .sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  return from && to ? { from, to } : null;
}
