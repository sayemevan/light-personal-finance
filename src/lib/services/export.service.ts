import "server-only";
import { Readable } from "node:stream";

import { getDriveClient } from "@/lib/google/client";
import { getWorkspaceForCurrentUser } from "@/lib/google/workspace";
import { AppError } from "@/lib/errors";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import {
  currentCalendarYear,
  getExpensesForYear,
  getIncomeForYear,
} from "@/lib/services/history.service";
import { loadLedger } from "@/lib/services/ledger.service";
import type { Expense, Income, Transfer } from "@/types/domain";
import type { ExportKind } from "@/types/reports";

export const EXPORT_KINDS = ["expenses", "income", "transfers", "all"] as const;

/** Byte-order mark so Excel opens the file as UTF-8 (e.g. shows ৳). */
const BOM = "﻿";

type Cell = string | number | undefined | null;

/**
 * Quote one CSV cell (RFC 4180). Text that a spreadsheet would treat as a
 * formula is prefixed with an apostrophe to prevent CSV injection.
 */
export function csvCell(value: Cell): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) || text !== text.trim()
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

function joinTags(tags: string[] | undefined): string {
  return (tags ?? [])
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .join("; ");
}

interface ExportData {
  expenses: Expense[];
  income: Income[];
  transfers: Transfer[];
  categoryName: (id: string | undefined) => string;
  accountName: (id: string | undefined) => string;
}

/** `year` is "YYYY" (rows dated in that year) or "live" (the whole live sheet). */
async function loadExportData(
  kind: ExportKind,
  year: string,
): Promise<ExportData> {
  const wantExpenses = kind === "expenses" || kind === "all";
  const wantIncome = kind === "income" || kind === "all";
  const wantTransfers = kind === "transfers" || kind === "all";
  const [ledger, expenses, income] = await Promise.all([
    loadLedger(),
    wantExpenses ? getExpensesForYear(year) : Promise.resolve([]),
    wantIncome ? getIncomeForYear(year) : Promise.resolve([]),
  ]);
  const inYear = <T extends { date: string }>(rows: T[]) =>
    year === "live" ? rows : rows.filter((r) => r.date.startsWith(`${year}-`));
  const byDate = <T extends { date: string }>(rows: T[]) =>
    [...rows].sort((a, b) => a.date.localeCompare(b.date));

  const categories = new Map(ledger.categories.map((c) => [c.id, c.name]));
  const accounts = new Map(ledger.accounts.map((a) => [a.id, a.name]));
  const lookup = (map: Map<string, string>) => (id: string | undefined) =>
    id ? (map.get(id) ?? "Unknown") : "";

  return {
    expenses: byDate(inYear(expenses)),
    income: byDate(inYear(income)),
    // Transfers are never archived; they only live in the live sheet.
    transfers: wantTransfers ? byDate(inYear(ledger.transfers)) : [],
    categoryName: lookup(categories),
    accountName: lookup(accounts),
  };
}

function buildCsv(kind: ExportKind, data: ExportData): string {
  const { categoryName: cat, accountName: acc } = data;
  switch (kind) {
    case "expenses":
      return toCsv(
        ["Date", "Amount", "Category", "Account", "Payment method", "Merchant", "Notes", "Tags"],
        data.expenses.map((e) => [
          e.date,
          e.amount,
          cat(e.categoryId),
          acc(e.accountId),
          PAYMENT_METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod,
          e.merchant,
          e.notes,
          joinTags(e.tags),
        ]),
      );
    case "income":
      return toCsv(
        ["Date", "Amount", "Category", "Account", "Notes", "Tags"],
        data.income.map((i) => [
          i.date,
          i.amount,
          cat(i.categoryId),
          acc(i.accountId),
          i.notes,
          joinTags(i.tags),
        ]),
      );
    case "transfers":
      return toCsv(
        ["Date", "Amount", "From account", "To account", "Notes"],
        data.transfers.map((t) => [
          t.date,
          t.amount,
          acc(t.fromAccountId),
          acc(t.toAccountId),
          t.notes,
        ]),
      );
    case "all": {
      const rows: { date: string; cells: Cell[] }[] = [
        ...data.expenses.map((e) => ({
          date: e.date,
          cells: [
            e.date, "Expense", e.amount, cat(e.categoryId), acc(e.accountId), "",
            PAYMENT_METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod,
            e.merchant, e.notes, joinTags(e.tags),
          ],
        })),
        ...data.income.map((i) => ({
          date: i.date,
          cells: [
            i.date, "Income", i.amount, cat(i.categoryId), acc(i.accountId), "",
            "", "", i.notes, joinTags(i.tags),
          ],
        })),
        ...data.transfers.map((t) => ({
          date: t.date,
          cells: [
            t.date, "Transfer", t.amount, "", acc(t.fromAccountId),
            acc(t.toAccountId), "", "", t.notes, "",
          ],
        })),
      ];
      rows.sort((a, b) => a.date.localeCompare(b.date));
      return toCsv(
        ["Date", "Type", "Amount", "Category", "Account", "To account", "Payment method", "Merchant", "Notes", "Tags"],
        rows.map((row) => row.cells),
      );
    }
  }
}

const KIND_TITLES: Record<ExportKind, string> = {
  expenses: "Expenses",
  income: "Income",
  transfers: "Transfers",
  all: "All transactions",
};

export function exportFileName(kind: ExportKind, year: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const label = year === "live" ? `${currentCalendarYear()} (live)` : year;
  return `${KIND_TITLES[kind]} ${label} (exported ${today}).csv`;
}

export async function buildExport(
  kind: ExportKind,
  year: string,
): Promise<{ fileName: string; csv: string }> {
  const data = await loadExportData(kind, year);
  return { fileName: exportFileName(kind, year), csv: buildCsv(kind, data) };
}

/** Save the export as a new CSV file in the user's Drive "Reports" folder. */
export async function saveExportToDrive(
  kind: ExportKind,
  year: string,
): Promise<{ fileId: string; webViewLink?: string; fileName: string }> {
  const [{ reportsFolderId }, { fileName, csv }] = await Promise.all([
    getWorkspaceForCurrentUser(),
    buildExport(kind, year),
  ]);
  const drive = await getDriveClient();
  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "text/csv",
      parents: [reportsFolderId],
    },
    media: {
      mimeType: "text/csv",
      body: Readable.from(Buffer.from(csv, "utf8")),
    },
    fields: "id, webViewLink",
  });
  if (!created.data.id) {
    throw AppError.internal("Failed to save the export to Google Drive.");
  }
  return {
    fileId: created.data.id,
    webViewLink: created.data.webViewLink ?? undefined,
    fileName,
  };
}
