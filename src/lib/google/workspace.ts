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

// Warm-instance cache so we don't re-scan Drive on every request. The ids
// practically never change; a deleted file surfaces as a 404 from Google.
const CACHE_TTL_MS = 30 * 60 * 1000;
/**
 * Spreadsheets whose tabs and headers were already checked in this server
 * instance. The check costs Sheets reads (60/min per user), and a schema
 * only changes with a deploy, which starts fresh instances anyway.
 */
const migrated = new Set<string>();
const workspaceCache = new Map<string, { value: FinanceWorkspace; ts: number }>();
const inflight = new Map<string, Promise<FinanceWorkspace>>();

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
  } else if (!migrated.has(spreadsheetId)) {
    // Non-destructive migration: make sure tabs added in later schema versions
    // exist, and that existing tabs have any columns appended since they were
    // created (e.g. accountId on Loan Payments).
    await ensureSheetTabs(spreadsheetId);
    await ensureSheetHeaders(spreadsheetId);
    migrated.add(spreadsheetId);
  }

  return { rootFolderId, spreadsheetId, receiptsFolderId, reportsFolderId };
}

/**
 * Ensure every worksheet declared in `SHEET_TABS` exists, creating any that are
 * missing and seeding their header row. Safe to call repeatedly.
 */
async function ensureSheetTabs(spreadsheetId: string): Promise<void> {
  const sheets = await getSheetsClient();
  const titles = async () => {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    return (meta.data.sheets ?? [])
      .map((sheet) => sheet.properties)
      .filter(
        (props): props is { sheetId: number; title: string } =>
          typeof props?.sheetId === "number" && Boolean(props?.title),
      );
  };

  const tabs = Object.values(SHEET_TABS);
  const existing = new Set((await titles()).map((tab) => tab.title));
  const missing = tabs.filter((tab) => !existing.has(tab));

  // Several instances may migrate at once. One request per tab, so a tab
  // another instance just added ("already exists") doesn't fail the others.
  for (const title of missing) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
    } catch (error) {
      if (!(error instanceof Error && /already exists/i.test(error.message))) {
        throw error;
      }
    }
  }

  // Simultaneous addSheet calls don't fail: Sheets keeps all of them and
  // renames the extras "<title>_conflict<n>". Remove those while empty.
  // Only possible when tabs were just added, so skip the re-read otherwise.
  if (missing.length === 0) return;
  const conflicts = (await titles()).filter((tab) =>
    tabs.some((title) => tab.title.startsWith(`${title}_conflict`)),
  );
  if (conflicts.length > 0) {
    const data = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: conflicts.map((tab) => `'${tab.title}'!A2:A`),
    });
    const empty = conflicts.filter(
      (_tab, i) => !(data.data.valueRanges?.[i]?.values?.length ?? 0),
    );
    if (empty.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: empty.map((tab) => ({
            deleteSheet: { sheetId: tab.sheetId },
          })),
        },
      });
    }
  }

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

  // Share one find-or-create per user: the dashboard fires many requests at
  // once, and on a fresh account each would otherwise create its own folder
  // and spreadsheet.
  let pending = inflight.get(userKey);
  if (!pending) {
    pending = ensureFinanceWorkspace()
      .then((workspace) => {
        workspaceCache.set(userKey, { value: workspace, ts: Date.now() });
        return workspace;
      })
      .finally(() => inflight.delete(userKey));
    inflight.set(userKey, pending);
  }
  return pending;
}

/** Convenience accessor returning just the spreadsheet id. */
export async function getSpreadsheetId(): Promise<string> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  return spreadsheetId;
}

/**
 * Drop the in-memory workspace cache so the next request re-resolves Drive
 * ids. Archive workbooks are looked up by name each run (they are not stored
 * here); clearing still keeps the live workspace fresh after Drive writes.
 */
export function invalidateWorkspaceCache(): void {
  workspaceCache.clear();
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
