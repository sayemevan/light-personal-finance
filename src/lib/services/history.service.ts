import "server-only";

import {
  ARCHIVE_NOTE_PREFIX,
  ARCHIVE_SUMMARY_TAB,
  DRIVE_STRUCTURE,
  SHEET_TABS,
} from "@/config/google";
import { findSpreadsheet } from "@/lib/google/drive";
import { readRange } from "@/lib/google/sheets";
import { getWorkspaceForCurrentUser } from "@/lib/google/workspace";
import { expensesRepo, incomeRepo } from "@/lib/repositories";
import { loadLedger } from "@/lib/services/ledger.service";
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

// ---------------------------------------------------------------------------
// Archive read cache
// ---------------------------------------------------------------------------

/**
 * Archive workbooks only change when an archive runs, yet every past-year
 * view and the year list read them, costing Sheets read quota (60/min per
 * user). Reads are cached per server instance and cleared by
 * `invalidateArchiveCache` after an archive run. Another instance may serve
 * a copy up to ARCHIVE_TTL_MS old; totals stay right meanwhile, because a
 * live rollup is only dropped once its month's detail rows are in hand.
 */
const ARCHIVE_TTL_MS = 10 * 60_000;
/** Shorter for "no archive yet", which changes on the first archive run. */
const NO_ARCHIVE_TTL_MS = 60_000;
const archiveCache = new Map<
  string,
  { at: number; ttl: number; value: Promise<unknown> }
>();

function cached<T>(
  key: string,
  load: () => Promise<T>,
  ttl = ARCHIVE_TTL_MS,
): Promise<T> {
  const hit = archiveCache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as Promise<T>;
  const value = load();
  archiveCache.set(key, { at: Date.now(), ttl, value });
  value.catch(() => archiveCache.delete(key));
  return value;
}

export function invalidateArchiveCache(): void {
  archiveCache.clear();
}

async function findArchiveId(
  kind: TransactionKind,
  rootFolderId: string,
): Promise<string | null> {
  const key = `id:${kind}:${rootFolderId}`;
  const id = await cached(key, () =>
    findSpreadsheet(archiveConfig(kind).title, rootFolderId),
  );
  if (id === null) {
    // Re-check "none" sooner than a found id.
    const entry = archiveCache.get(key);
    if (entry) entry.ttl = NO_ARCHIVE_TTL_MS;
  }
  return id;
}

function archivedExpenses(archiveId: string): Promise<Expense[]> {
  return cached(`rows:${archiveId}`, () => expensesRepo.list(archiveId));
}

function archivedIncome(archiveId: string): Promise<Income[]> {
  return cached(`rows:${archiveId}`, () => incomeRepo.list(archiveId));
}

/** Combine two row sets, keeping live-sheet rows when an id appears in both. */
/**
 * Combine live and archived rows for a past year. Archiving leaves one monthly
 * rollup row in the live sheet per month it moved, so a rollup is dropped when
 * the archive holds that month's detail rows; otherwise it would be counted
 * on top of them.
 */
function mergeById<T extends { id: string; date: string; notes?: string }>(
  live: T[],
  archived: T[],
): T[] {
  const archivedMonths = new Set(archived.map((row) => row.date.slice(0, 7)));
  const liveKept = live.filter(
    (row) =>
      !(
        (row.notes ?? "").startsWith(ARCHIVE_NOTE_PREFIX) &&
        archivedMonths.has(row.date.slice(0, 7))
      ),
  );
  const seen = new Set(liveKept.map((row) => row.id));
  return [...liveKept, ...archived.filter((row) => !seen.has(row.id))];
}

export async function getExpensesForYear(year: string): Promise<Expense[]> {
  const { spreadsheetId, rootFolderId } = await getWorkspaceForCurrentUser();
  const liveRows = (await loadLedger(spreadsheetId)).expenses;

  // "live" (or the current calendar year) is the working view: everything in
  // the live sheet, unfiltered by date, plus this year's archived details in
  // place of their monthly rollups (an archive run also moves current-year
  // rows, which would otherwise lose their tags, merchants and notes here).
  if (isLiveYear(year)) {
    const archiveId = await findArchiveId("expense", rootFolderId);
    if (!archiveId) return liveRows;
    const thisYear = `${currentCalendarYear()}-`;
    const archived = (await archivedExpenses(archiveId)).filter((row) =>
      row.date.startsWith(thisYear),
    );
    return archived.length > 0 ? mergeById(liveRows, archived) : liveRows;
  }

  // For any other year, a row may live in either the archive (past years that
  // were archived) or still in the live sheet (e.g. a future-dated entry that
  // was never archived). Include both so nothing disappears based on storage.
  const liveForYear = liveRows.filter((row) => row.date.startsWith(`${year}-`));
  const archiveId = await findArchiveId("expense", rootFolderId);
  const archiveForYear = archiveId
    ? (await archivedExpenses(archiveId)).filter((row) =>
        row.date.startsWith(`${year}-`),
      )
    : [];

  return mergeById(liveForYear, archiveForYear);
}

export async function getIncomeForYear(year: string): Promise<Income[]> {
  const { spreadsheetId, rootFolderId } = await getWorkspaceForCurrentUser();
  const liveRows = (await loadLedger(spreadsheetId)).income;

  // See getExpensesForYear.
  if (isLiveYear(year)) {
    const archiveId = await findArchiveId("income", rootFolderId);
    if (!archiveId) return liveRows;
    const thisYear = `${currentCalendarYear()}-`;
    const archived = (await archivedIncome(archiveId)).filter((row) =>
      row.date.startsWith(thisYear),
    );
    return archived.length > 0 ? mergeById(liveRows, archived) : liveRows;
  }

  const liveForYear = liveRows.filter((row) => row.date.startsWith(`${year}-`));
  const archiveId = await findArchiveId("income", rootFolderId);
  const archiveForYear = archiveId
    ? (await archivedIncome(archiveId)).filter((row) =>
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
  const ledger = await loadLedger(spreadsheetId);
  const liveRows = kind === "expense" ? ledger.expenses : ledger.income;
  const years = new Set<string>([currentCalendarYear()]);

  for (const row of liveRows) {
    const year = row.date.slice(0, 4);
    if (/^\d{4}$/.test(year)) years.add(year);
  }

  const archiveId = await findArchiveId(kind, rootFolderId);
  if (archiveId) {
    const [detailRows, summaryRows] = await Promise.all([
      kind === "expense"
        ? archivedExpenses(archiveId)
        : archivedIncome(archiveId),
      cached(`summary:${archiveId}`, () =>
        readRange(archiveId, `${ARCHIVE_SUMMARY_TAB}!A2:A`),
      ),
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
