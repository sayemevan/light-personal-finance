import "server-only";
import { auth } from "@/auth";
import { getSheetsClient, getDriveClient } from "@/lib/google/client";
import {
  findFolder,
  createFolder,
  findSpreadsheet,
} from "@/lib/google/drive";
import {
  DRIVE_STRUCTURE,
  SHEET_TABS,
  SHEET_COLUMNS,
  SCHEMA_VERSION,
  type SheetTab,
} from "@/config/google";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  DEFAULT_CURRENCY,
} from "@/config/defaults";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";

export interface FinanceWorkspace {
  rootFolderId: string;
  spreadsheetId: string;
  receiptsFolderId: string;
  reportsFolderId: string;
}

// Warm-instance cache so we don't re-scan Drive on every request.
const CACHE_TTL_MS = 5 * 60 * 1000;
const workspaceCache = new Map<string, { value: FinanceWorkspace; ts: number }>();

/**
 * Idempotently ensure the Drive folder structure and Finance spreadsheet exist,
 * creating and seeding them on first run and reusing them thereafter.
 */
export async function ensureFinanceWorkspace(): Promise<FinanceWorkspace> {
  const rootFolderId =
    (await findFolder(DRIVE_STRUCTURE.rootFolder)) ??
    (await createFolder(DRIVE_STRUCTURE.rootFolder));

  const receiptsFolderId =
    (await findFolder(DRIVE_STRUCTURE.receiptsFolder, rootFolderId)) ??
    (await createFolder(DRIVE_STRUCTURE.receiptsFolder, rootFolderId));

  const reportsFolderId =
    (await findFolder(DRIVE_STRUCTURE.reportsFolder, rootFolderId)) ??
    (await createFolder(DRIVE_STRUCTURE.reportsFolder, rootFolderId));

  let spreadsheetId = await findSpreadsheet(
    DRIVE_STRUCTURE.spreadsheet,
    rootFolderId,
  );
  if (!spreadsheetId) {
    spreadsheetId = await createFinanceSpreadsheet(rootFolderId);
  } else {
    // Non-destructive migration: make sure tabs added in later schema versions
    // exist, and that existing tabs have any columns appended since they were
    // created (e.g. accountId on Loan Payments).
    await ensureSheetTabs(spreadsheetId);
    await ensureSheetHeaders(spreadsheetId);
  }

  return { rootFolderId, spreadsheetId, receiptsFolderId, reportsFolderId };
}

/**
 * Ensure every worksheet declared in `SHEET_TABS` exists, creating any that are
 * missing and seeding their header row. Safe to call repeatedly.
 */
async function ensureSheetTabs(spreadsheetId: string): Promise<void> {
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

  const missing = Object.values(SHEET_TABS).filter(
    (tab) => !existing.has(tab),
  );
  if (missing.length === 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
    },
  });

  const hasColumns = (tab: string): tab is keyof typeof SHEET_COLUMNS =>
    tab in SHEET_COLUMNS;

  const headerData = missing
    .filter(hasColumns)
    .map((tab) => ({
      range: `${tab}!A1`,
      values: [[...SHEET_COLUMNS[tab]]],
    }));

  if (headerData.length > 0) {
    await sheets_batchUpdateValues(spreadsheetId, headerData);
  }
}

/**
 * Rewrite header rows that are missing columns appended in later schema
 * versions. Existing data rows are left untouched; new cells stay empty until
 * a record is written with the extra field.
 */
async function ensureSheetHeaders(spreadsheetId: string): Promise<void> {
  const sheets = await getSheetsClient();
  const hasColumns = (tab: string): tab is keyof typeof SHEET_COLUMNS =>
    tab in SHEET_COLUMNS;
  const tabs = Object.values(SHEET_TABS).filter(hasColumns);

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: tabs.map((tab) => `${tab}!1:1`),
  });

  const stale = tabs.filter((tab, index) => {
    const headers =
      (res.data.valueRanges?.[index]?.values?.[0] as string[] | undefined) ??
      [];
    const expected = SHEET_COLUMNS[tab];
    return expected.some((column, columnIndex) => headers[columnIndex] !== column);
  });

  if (stale.length === 0) return;

  await sheets_batchUpdateValues(
    spreadsheetId,
    stale.map((tab) => ({
      range: `${tab}!A1`,
      values: [[...SHEET_COLUMNS[tab]]],
    })),
  );
}

/** Resolve (and cache) the workspace for the currently signed-in user. */
export async function getWorkspaceForCurrentUser(): Promise<FinanceWorkspace> {
  const session = await auth();
  const userKey = session?.user?.id || session?.user?.email;
  if (!userKey) throw AppError.unauthenticated();

  const cached = workspaceCache.get(userKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.value;
  }

  const workspace = await ensureFinanceWorkspace();
  workspaceCache.set(userKey, { value: workspace, ts: Date.now() });
  return workspace;
}

/** Convenience accessor returning just the spreadsheet id. */
export async function getSpreadsheetId(): Promise<string> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  return spreadsheetId;
}

/** Create the spreadsheet with all tabs, move it into the folder, and seed it. */
async function createFinanceSpreadsheet(rootFolderId: string): Promise<string> {
  const sheets = await getSheetsClient();
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: DRIVE_STRUCTURE.spreadsheet },
      sheets: Object.values(SHEET_TABS).map((title) => ({
        properties: { title },
      })),
    },
    fields: "spreadsheetId",
  });

  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) {
    throw AppError.internal("Failed to create the Finance spreadsheet.");
  }

  // Move the new spreadsheet from Drive root into the "My Finance" folder.
  const drive = await getDriveClient();
  const file = await drive.files.get({ fileId: spreadsheetId, fields: "parents" });
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: rootFolderId,
    removeParents: (file.data.parents ?? []).join(","),
    fields: "id",
  });

  await seedSpreadsheet(spreadsheetId);
  return spreadsheetId;
}

/** Write header rows for every tab plus default settings/accounts/categories. */
async function seedSpreadsheet(spreadsheetId: string): Promise<void> {
  const now = new Date().toISOString();

  const hasColumns = (
    tab: SheetTab,
  ): tab is keyof typeof SHEET_COLUMNS => tab in SHEET_COLUMNS;

  const header = (tab: keyof typeof SHEET_COLUMNS) => [...SHEET_COLUMNS[tab]];

  const data: { range: string; values: (string | number)[][] }[] = [
    // Headers for every tab that defines a schema. Some tabs (e.g. Dashboard)
    // are presentation-only and have no columns, so they are skipped here.
    ...Object.values(SHEET_TABS)
      .filter(hasColumns)
      .map((tab) => ({
        range: `${tab}!A1`,
        values: [header(tab)],
      })),
    // Settings key/value rows.
    {
      range: `${SHEET_TABS.settings}!A2`,
      values: [
        ["schemaVersion", String(SCHEMA_VERSION)],
        ["currency", DEFAULT_CURRENCY],
        ["createdAt", now],
      ],
    },
    // Default accounts.
    {
      range: `${SHEET_TABS.accounts}!A2`,
      values: DEFAULT_ACCOUNTS.map((account) => [
        generateId(),
        account.name,
        account.type,
        0,
        DEFAULT_CURRENCY,
        "FALSE",
        now,
      ]),
    },
    // Default categories.
    {
      range: `${SHEET_TABS.categories}!A2`,
      values: DEFAULT_CATEGORIES.map((category) => [
        generateId(),
        category.name,
        category.kind,
        category.icon ?? "",
        "TRUE",
        "FALSE",
      ]),
    },
  ];

  await sheets_batchUpdateValues(spreadsheetId, data);
}

async function sheets_batchUpdateValues(
  spreadsheetId: string,
  data: { range: string; values: (string | number)[][] }[],
): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
}
