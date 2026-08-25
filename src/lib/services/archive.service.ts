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
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type { Cell } from "@/lib/google/repository";
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

async function appendArchivePayload(
  archiveId: string,
  detailTab: string,
  detailRows: Cell[][],
  summaryRows: (string | number)[][],
): Promise<void> {
  const [detailStart, summaryStart] = await Promise.all([
    nextEmptyRow(archiveId, detailTab),
    nextEmptyRow(archiveId, ARCHIVE_SUMMARY_TAB),
  ]);

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: archiveId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${detailTab}!A${detailStart}`, values: detailRows },
        {
          range: `${ARCHIVE_SUMMARY_TAB}!A${summaryStart}`,
          values: summaryRows,
        },
      ],
    },
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
    } else {
      buckets.set(key, {
        month,
        accountId: row.accountId,
        categoryId: row.categoryId,
        amount: row.amount,
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
      id: generateId(),
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
      id: generateId(),
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

/**
 * Copy expense or income detail rows into a dedicated Drive archive
 * spreadsheet, then replace them in the live tab with per-account yearly
 * rollups so balances and yearly cash flow stay intact.
 */
export async function archiveTransactions(
  kind: CategoryKind,
): Promise<ArchiveResult> {
  const { spreadsheetId, rootFolderId } = await getWorkspaceForCurrentUser();
  const now = new Date().toISOString();

  if (kind === "expense") {
    const all = await expensesRepo.list(spreadsheetId);
    const toArchive = all.filter(
      (row) => !isArchiveRollup(row.notes) && calendarYear(row.date),
    );
    if (toArchive.length === 0) {
      return { kind, years: [], archivedCount: 0, rollupCount: 0 };
    }

    const archiveIds = new Set(toArchive.map((row) => row.id));
    const keep = all.filter((row) => !archiveIds.has(row.id));
    const byYear = groupByYear(toArchive);
    const years = yearSummaries(byYear);
    const rollups = rollupExpenses(toArchive, now);

    const archiveId = await ensureArchiveSpreadsheet(
      DRIVE_STRUCTURE.expenseArchive,
      SHEET_TABS.expenses,
      SHEET_COLUMNS[SHEET_TABS.expenses],
      rootFolderId,
    );

    await appendArchivePayload(
      archiveId,
      SHEET_TABS.expenses,
      toArchive.map((row) => expensesRepo.toRow(row)),
      years.map((year) => [year.year, year.total, now, year.rowCount]),
    );

    await expensesRepo.replaceAll(spreadsheetId, [...keep, ...rollups]);
    invalidateWorkspaceCache();

    return {
      kind,
      years,
      archivedCount: toArchive.length,
      rollupCount: rollups.length,
    };
  }

  const all = await incomeRepo.list(spreadsheetId);
  const toArchive = all.filter(
    (row) => !isArchiveRollup(row.notes) && calendarYear(row.date),
  );
  if (toArchive.length === 0) {
    return { kind, years: [], archivedCount: 0, rollupCount: 0 };
  }

  const archiveIds = new Set(toArchive.map((row) => row.id));
  const keep = all.filter((row) => !archiveIds.has(row.id));
  const byYear = groupByYear(toArchive);
  const years = yearSummaries(byYear);
  const rollups = rollupIncome(toArchive, now);

  const archiveId = await ensureArchiveSpreadsheet(
    DRIVE_STRUCTURE.incomeArchive,
    SHEET_TABS.income,
    SHEET_COLUMNS[SHEET_TABS.income],
    rootFolderId,
  );

  await appendArchivePayload(
    archiveId,
    SHEET_TABS.income,
    toArchive.map((row) => incomeRepo.toRow(row)),
    years.map((year) => [year.year, year.total, now, year.rowCount]),
  );

  await incomeRepo.replaceAll(spreadsheetId, [...keep, ...rollups]);
  invalidateWorkspaceCache();

  return {
    kind,
    years,
    archivedCount: toArchive.length,
    rollupCount: rollups.length,
  };
}
