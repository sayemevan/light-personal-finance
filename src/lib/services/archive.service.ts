import "server-only";

import {
  ARCHIVE_NOTE_PREFIX,
  ARCHIVE_SUMMARY_COLUMNS,
  ARCHIVE_SUMMARY_TAB,
  DRIVE_STRUCTURE,
  SHEET_COLUMNS,
  SHEET_TABS,
} from "@/config/google";
import { getDriveClient, getSheetsClient } from "@/lib/google/client";
import { findSpreadsheet } from "@/lib/google/drive";
import {
  getWorkspaceForCurrentUser,
  invalidateWorkspaceCache,
} from "@/lib/google/workspace";
import { AppError } from "@/lib/errors";
import { createHash } from "node:crypto";
import { withLocalLock } from "@/lib/google/lock";
import type { SheetRepository } from "@/lib/google/repository";
import { expensesRepo, incomeRepo } from "@/lib/repositories";
import type { ArchiveResult, ArchiveYearSummary } from "@/types/api";
import type { CategoryKind, Expense, Income } from "@/types/domain";

export type { ArchiveResult, ArchiveYearSummary };

type Archiveable = Expense | Income;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function calendarYear(date: string): string | null {
  const year = date.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

/** `YYYY-MM` bucket for a date, or null if the date is malformed. */
function calendarMonth(date: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(date);
  return match ? `${match[1]}-${match[2]}` : null;
}

/** Last calendar day of a `YYYY-MM` bucket, formatted `YYYY-MM-DD`. */
function lastDayOfMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const monthNum = Number(month.slice(5, 7));
  const day = new Date(year, monthNum, 0).getDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

function isArchiveRollup(notes: string | undefined): boolean {
  return (notes ?? "").startsWith(ARCHIVE_NOTE_PREFIX);
}

async function nextEmptyRow(
  spreadsheetId: string,
  tab: string,
): Promise<number> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:A`,
  });
  return (res.data.values?.length ?? 0) + 1;
}

async function createArchiveSpreadsheet(
  title: string,
  detailTab: string,
  columns: readonly string[],
  parentId: string,
): Promise<string> {
  const sheets = await getSheetsClient();
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: detailTab } },
        { properties: { title: ARCHIVE_SUMMARY_TAB } },
      ],
    },
    fields: "spreadsheetId",
  });

  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) {
    throw AppError.internal(`Failed to create "${title}".`);
  }

  const drive = await getDriveClient();
  const file = await drive.files.get({
    fileId: spreadsheetId,
    fields: "parents",
  });
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: parentId,
    removeParents: (file.data.parents ?? []).join(","),
    fields: "id",
  });

  await writeArchiveHeaders(spreadsheetId, detailTab, columns);
  return spreadsheetId;
}

async function writeArchiveHeaders(
  spreadsheetId: string,
  detailTab: string,
  columns: readonly string[],
): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${detailTab}!A1`, values: [[...columns]] },
        {
          range: `${ARCHIVE_SUMMARY_TAB}!A1`,
          values: [[...ARCHIVE_SUMMARY_COLUMNS]],
        },
      ],
    },
  });
}

async function ensureArchiveTabsAndHeaders(
  spreadsheetId: string,
  detailTab: string,
  columns: readonly string[],
): Promise<void> {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const existing = new Set(
    (meta.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)),
  );

  const missing = [detailTab, ARCHIVE_SUMMARY_TAB].filter(
    (tab) => !existing.has(tab),
  );
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({
          addSheet: { properties: { title } },
        })),
      },
    });
  }

  const headerRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`${detailTab}!1:1`, `${ARCHIVE_SUMMARY_TAB}!1:1`],
  });

  const detailHeaders =
    (headerRes.data.valueRanges?.[0]?.values?.[0] as string[] | undefined) ??
    [];
  const summaryHeaders =
    (headerRes.data.valueRanges?.[1]?.values?.[0] as string[] | undefined) ??
    [];

  const detailStale = columns.some(
    (column, index) => detailHeaders[index] !== column,
  );
  const summaryStale = ARCHIVE_SUMMARY_COLUMNS.some(
    (column, index) => summaryHeaders[index] !== column,
  );

  if (detailStale || summaryStale || missing.length > 0) {
    await writeArchiveHeaders(spreadsheetId, detailTab, columns);
  }
}

async function ensureArchiveSpreadsheet(
  title: string,
  detailTab: string,
  columns: readonly string[],
  parentId: string,
): Promise<string> {
  const existing = await findSpreadsheet(title, parentId);
  if (!existing) {
    return createArchiveSpreadsheet(title, detailTab, columns, parentId);
  }
  await ensureArchiveTabsAndHeaders(existing, detailTab, columns);
  return existing;
}

/** Informational per-run totals on the archive's Summary tab. */
async function appendArchiveSummary(
  archiveId: string,
  summaryRows: (string | number)[][],
): Promise<void> {
  const summaryStart = await nextEmptyRow(archiveId, ARCHIVE_SUMMARY_TAB);
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: archiveId,
    range: `${ARCHIVE_SUMMARY_TAB}!A${summaryStart}`,
    valueInputOption: "RAW",
    requestBody: { values: summaryRows },
  });
}

function groupByYear<T extends Archiveable>(
  rows: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const year = calendarYear(row.date);
    if (!year) continue;
    const list = groups.get(year);
    if (list) list.push(row);
    else groups.set(year, [row]);
  }
  return groups;
}

function yearSummaries<T extends Archiveable>(
  byYear: Map<string, T[]>,
): ArchiveYearSummary[] {
  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, rows]) => ({
      year,
      total: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
      rowCount: rows.length,
    }));
}

interface RollupBucket {
  month: string;
  accountId: string;
  categoryId: string;
  amount: number;
  /** Ids of the detail rows folded into this bucket. */
  ids: string[];
}

/**
 * Rollup id derived from the rows it replaces, so two archive runs over the
 * same rows produce the same id and `keepFirstOf` can drop the duplicate.
 */
function rollupId(bucket: RollupBucket): string {
  const digest = createHash("sha256")
    .update([...bucket.ids].sort().join(","))
    .digest("hex")
    .slice(0, 24);
  return `rollup_${bucket.month}_${digest}`;
}

/**
 * Collapse detail rows into one bucket per (month, account, category) so that
 * per-month trends, per-category breakdowns and per-account balances all stay
 * accurate after the underlying rows are removed from the live sheet. Rows
 * without an account are kept under an empty account id so their amount is
 * never silently dropped from category / monthly totals.
 */
function bucketByMonth<T extends Archiveable>(rows: T[]): RollupBucket[] {
  const buckets = new Map<string, RollupBucket>();
  for (const row of rows) {
    const month = calendarMonth(row.date);
    if (!month) continue;
    const key = `${month}|${row.accountId}|${row.categoryId}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.amount += row.amount;
      existing.ids.push(row.id);
    } else {
      buckets.set(key, {
        month,
        accountId: row.accountId,
        categoryId: row.categoryId,
        amount: row.amount,
        ids: [row.id],
      });
    }
  }
  return [...buckets.values()];
}

function rollupExpenses(rows: Expense[], now: string): Expense[] {
  const rollups: Expense[] = [];
  for (const bucket of bucketByMonth(rows)) {
    const total = round2(bucket.amount);
    if (total <= 0) continue;
    rollups.push({
      id: rollupId(bucket),
      date: lastDayOfMonth(bucket.month),
      amount: total,
      categoryId: bucket.categoryId,
      accountId: bucket.accountId,
      paymentMethod: "other",
      merchant: "Monthly archive",
      notes: `${ARCHIVE_NOTE_PREFIX}${bucket.month}] Monthly archive`,
      createdAt: now,
      updatedAt: now,
    });
  }
  return rollups;
}

function rollupIncome(rows: Income[], now: string): Income[] {
  const rollups: Income[] = [];
  for (const bucket of bucketByMonth(rows)) {
    const total = round2(bucket.amount);
    if (total <= 0) continue;
    rollups.push({
      id: rollupId(bucket),
      date: lastDayOfMonth(bucket.month),
      amount: total,
      categoryId: bucket.categoryId,
      accountId: bucket.accountId,
      notes: `${ARCHIVE_NOTE_PREFIX}${bucket.month}] Monthly archive`,
      createdAt: now,
      updatedAt: now,
    });
  }
  return rollups;
}

/** Ids already present in an archive's detail tab. */
async function archivedIds(archiveId: string, detailTab: string): Promise<Set<string>> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: archiveId,
    range: `${detailTab}!A2:A`,
  });
  return new Set(
    ((res.data.values as string[][] | undefined) ?? [])
      .map((row) => row[0])
      .filter((id): id is string => Boolean(id)),
  );
}

interface ArchiveTarget<T extends Archiveable> {
  repo: SheetRepository<T>;
  title: string;
  tab: typeof SHEET_TABS.expenses | typeof SHEET_TABS.income;
  rollup: (rows: T[], now: string) => T[];
}

/**
 * Copy expense or income detail rows into a dedicated Drive archive
 * spreadsheet, then replace them in the live tab with per-account monthly
 * rollups so balances and cash flow stay intact.
 *
 * Safe to retry, to run twice at once and to run alongside normal use:
 * - rows already in the archive (from a run that failed half-way) are not
 *   copied again, and copies made by two concurrent runs are de-duplicated;
 * - the live tab is changed in one atomic batch that blanks only the archived
 *   rows and adds the rollups, so entries added meanwhile survive and a
 *   failure changes nothing;
 * - rollup ids derive from the rows they replace, so concurrent runs produce
 *   the same rollups and the duplicate is dropped.
 */
export async function archiveTransactions(
  kind: CategoryKind,
): Promise<ArchiveResult> {
  const { spreadsheetId, rootFolderId } = await getWorkspaceForCurrentUser();
  const result = await withLocalLock(
    `${spreadsheetId}:archive`,
    () =>
      kind === "expense"
        ? archiveInto(kind, spreadsheetId, rootFolderId, {
            repo: expensesRepo,
            title: DRIVE_STRUCTURE.expenseArchive,
            tab: SHEET_TABS.expenses,
            rollup: rollupExpenses,
          })
        : archiveInto(kind, spreadsheetId, rootFolderId, {
            repo: incomeRepo,
            title: DRIVE_STRUCTURE.incomeArchive,
            tab: SHEET_TABS.income,
            rollup: rollupIncome,
          }),
  );
  invalidateWorkspaceCache();
  return result;
}

async function archiveInto<T extends Archiveable>(
  kind: CategoryKind,
  spreadsheetId: string,
  rootFolderId: string,
  target: ArchiveTarget<T>,
): Promise<ArchiveResult> {
  const now = new Date().toISOString();
  const all = await target.repo.list(spreadsheetId);
  const toArchive = all.filter(
    (row) => !isArchiveRollup(row.notes) && calendarYear(row.date),
  );
  if (toArchive.length === 0) {
    return { kind, years: [], archivedCount: 0, rollupCount: 0 };
  }

  const years = yearSummaries(groupByYear(toArchive));
  const rollups = target.rollup(toArchive, now);

  const archiveId = await ensureArchiveSpreadsheet(
    target.title,
    target.tab,
    SHEET_COLUMNS[target.tab],
    rootFolderId,
  );

  // The archive's detail tab has the live tab's name and columns, so the
  // same repository reads and writes it.
  const archiveIds = new Set(toArchive.map((row) => row.id));
  const already = await archivedIds(archiveId, target.tab);
  const fresh = toArchive.filter((row) => !already.has(row.id));
  if (fresh.length > 0) {
    await target.repo.appendMany(archiveId, fresh);
    await appendArchiveSummary(
      archiveId,
      yearSummaries(groupByYear(fresh)).map((year) => [
        year.year,
        year.total,
        now,
        year.rowCount,
      ]),
    );
  }
  await target.repo.keepFirstOf(archiveId, archiveIds);

  await target.repo.removeIdsAndAppend(spreadsheetId, archiveIds, rollups);
  await target.repo.keepFirstOf(
    spreadsheetId,
    new Set(rollups.map((row) => row.id)),
  );

  return {
    kind,
    years,
    archivedCount: toArchive.length,
    rollupCount: rollups.length,
  };
}
