import "server-only";

import {
  ARCHIVE_SUMMARY_TAB,
  DRIVE_STRUCTURE,
  SHEET_TABS,
} from "@/config/google";
import { findSpreadsheet } from "@/lib/google/drive";
import { readRange } from "@/lib/google/sheets";
import { getWorkspaceForCurrentUser } from "@/lib/google/workspace";
import { expensesRepo, incomeRepo } from "@/lib/repositories";
import type { Expense, Income } from "@/types/domain";

export type TransactionKind = "expense" | "income";

export interface ArchiveYears {
  expense: string[];
  income: string[];
  all: string[];
}

export function currentCalendarYear(): string {
  return String(new Date().getFullYear());
}

export function isLiveYear(year: string): boolean {
  return year === "live" || year === currentCalendarYear();
}

function archiveConfig(kind: TransactionKind) {
  return kind === "expense"
    ? {
        title: DRIVE_STRUCTURE.expenseArchive,
        tab: SHEET_TABS.expenses,
      }
    : {
        title: DRIVE_STRUCTURE.incomeArchive,
        tab: SHEET_TABS.income,
      };
}

async function findArchiveId(
  kind: TransactionKind,
  rootFolderId: string,
): Promise<string | null> {
  return findSpreadsheet(archiveConfig(kind).title, rootFolderId);
}

/** Combine two row sets, keeping live-sheet rows when an id appears in both. */
function mergeById<T extends { id: string }>(live: T[], archived: T[]): T[] {
  const seen = new Set(live.map((row) => row.id));
  return [...live, ...archived.filter((row) => !seen.has(row.id))];
}

export async function getExpensesForYear(year: string): Promise<Expense[]> {
  const { spreadsheetId, rootFolderId } = await getWorkspaceForCurrentUser();
  const liveRows = await expensesRepo.list(spreadsheetId);

  // "live" (or the current calendar year) is the working view: show everything
  // currently in the live sheet, unfiltered by date.
  if (isLiveYear(year)) {
    return liveRows;
  }

  // For any other year, a row may live in either the archive (past years that
  // were archived) or still in the live sheet (e.g. a future-dated entry that
  // was never archived). Include both so nothing disappears based on storage.
  const liveForYear = liveRows.filter((row) => row.date.startsWith(`${year}-`));
  const archiveId = await findArchiveId("expense", rootFolderId);
  const archiveForYear = archiveId
    ? (await expensesRepo.list(archiveId)).filter((row) =>
        row.date.startsWith(`${year}-`),
      )
    : [];

  return mergeById(liveForYear, archiveForYear);
}

export async function getIncomeForYear(year: string): Promise<Income[]> {
  const { spreadsheetId, rootFolderId } = await getWorkspaceForCurrentUser();
  const liveRows = await incomeRepo.list(spreadsheetId);

  if (isLiveYear(year)) {
    return liveRows;
  }

  const liveForYear = liveRows.filter((row) => row.date.startsWith(`${year}-`));
  const archiveId = await findArchiveId("income", rootFolderId);
  const archiveForYear = archiveId
    ? (await incomeRepo.list(archiveId)).filter((row) =>
        row.date.startsWith(`${year}-`),
      )
    : [];

  return mergeById(liveForYear, archiveForYear);
}

async function getYearsForKind(
  kind: TransactionKind,
  spreadsheetId: string,
  rootFolderId: string,
): Promise<string[]> {
  const liveRows =
    kind === "expense"
      ? await expensesRepo.list(spreadsheetId)
      : await incomeRepo.list(spreadsheetId);
  const years = new Set<string>([currentCalendarYear()]);

  for (const row of liveRows) {
    const year = row.date.slice(0, 4);
    if (/^\d{4}$/.test(year)) years.add(year);
  }

  const archiveId = await findArchiveId(kind, rootFolderId);
  if (archiveId) {
    const [detailRows, summaryRows] = await Promise.all([
      kind === "expense"
        ? expensesRepo.list(archiveId)
        : incomeRepo.list(archiveId),
      readRange(archiveId, `${ARCHIVE_SUMMARY_TAB}!A2:A`),
    ]);
    for (const row of detailRows) {
      const year = row.date.slice(0, 4);
      if (/^\d{4}$/.test(year)) years.add(year);
    }
    for (const row of summaryRows) {
      const year = row[0]?.trim();
      if (year && /^\d{4}$/.test(year)) years.add(year);
    }
  }

  return [...years].sort((a, b) => b.localeCompare(a));
}

export async function getArchiveYears(): Promise<ArchiveYears> {
  const { spreadsheetId, rootFolderId } = await getWorkspaceForCurrentUser();
  const [expense, income] = await Promise.all([
    getYearsForKind("expense", spreadsheetId, rootFolderId),
    getYearsForKind("income", spreadsheetId, rootFolderId),
  ]);
  const all = [...new Set([...expense, ...income])].sort((a, b) =>
    b.localeCompare(a),
  );
  return { expense, income, all };
}
