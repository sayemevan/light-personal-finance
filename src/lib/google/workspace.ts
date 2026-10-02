import "server-only";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSheetsClient, getDriveClient } from "@/lib/google/client";
import {
  findFolder,
  createFolder,
  findSpreadsheet,
  isLiveFile,
  listFolders,
  listSpreadsheets,
  trashFile,
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
 * Browser cookie pinning the resolved workspace ids. Serverless requests land
 * on different instances, and Drive search can miss a file created moments
 * earlier, so an instance that only searched could create (and then write to)
 * a second Finance spreadsheet. With the ids pinned, every request from the
 * browser uses the same files. The ids grant nothing without the user's OAuth
 * token.
 */
const WORKSPACE_COOKIE = "pf_workspace";
const WORKSPACE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Idempotently ensure the Drive folder structure and Finance spreadsheet exist,
 * creating and seeding them on first run and reusing them thereafter.
 */
export async function ensureFinanceWorkspace(): Promise<FinanceWorkspace> {
  const rootFolderId = await findOrCreateFolder(DRIVE_STRUCTURE.rootFolder);
  const receiptsFolderId = await findOrCreateFolder(
    DRIVE_STRUCTURE.receiptsFolder,
    rootFolderId,
  );
  const reportsFolderId = await findOrCreateFolder(
    DRIVE_STRUCTURE.reportsFolder,
    rootFolderId,
  );

  let spreadsheetId = await findSpreadsheet(
    DRIVE_STRUCTURE.spreadsheet,
    rootFolderId,
  );
  if (!spreadsheetId) {
    const created = await createFinanceSpreadsheet(rootFolderId);
    spreadsheetId = await adoptOldest(created, () =>
      listSpreadsheets(DRIVE_STRUCTURE.spreadsheet, rootFolderId),
    );
    migrated.add(created);
  }
  await migrateOnce(spreadsheetId);

  return { rootFolderId, spreadsheetId, receiptsFolderId, reportsFolderId };
}

async function findOrCreateFolder(
  name: string,
  parentId?: string,
): Promise<string> {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  const created = await createFolder(name, parentId);
  return adoptOldest(created, () => listFolders(name, parentId));
}

/**
 * After creating a file, check whether another instance created one too and
 * converge on the oldest: trash ours (it is new and empty) and use theirs.
 */
async function adoptOldest(
  created: string,
  list: () => Promise<string[]>,
): Promise<string> {
  const oldest = (await list())[0];
  if (!oldest || oldest === created) return created;
  await trashFile(created).catch(() => undefined);
  return oldest;
}

/**
 * Non-destructive migration: make sure tabs added in later schema versions
 * exist, and that existing tabs have any columns appended since they were
 * created (e.g. accountId on Loan Payments).
 */
async function migrateOnce(spreadsheetId: string): Promise<void> {
  if (migrated.has(spreadsheetId)) return;
  await ensureSheetTabs(spreadsheetId);
  await ensureSheetHeaders(spreadsheetId);
  migrated.add(spreadsheetId);
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

  const cookieStore = await cookies();
  const pinned = readPinned(cookieStore.get(WORKSPACE_COOKIE)?.value, userKey);

  const cached = workspaceCache.get(userKey);
  let workspace: FinanceWorkspace;
  if (
    cached &&
    Date.now() - cached.ts < CACHE_TTL_MS &&
    (!pinned || pinned.spreadsheetId === cached.value.spreadsheetId)
  ) {
    workspace = cached.value;
  } else {
    // Share one resolve per user: the dashboard fires many requests at once,
    // and on a fresh account each would otherwise create its own folder and
    // spreadsheet.
    const key = `${userKey}:${pinned?.spreadsheetId ?? ""}`;
    let pending = inflight.get(key);
    if (!pending) {
      pending = resolveWorkspace(pinned)
        .then((value) => {
          workspaceCache.set(userKey, { value, ts: Date.now() });
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    workspace = await pending;
  }

  if (!sameWorkspace(pinned, workspace)) {
    try {
      cookieStore.set(WORKSPACE_COOKIE, JSON.stringify({ u: userKey, ...workspace }), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: WORKSPACE_COOKIE_MAX_AGE,
      });
    } catch {
      // Server components can't set cookies; the next API request will.
    }
  }
  return workspace;
}

/** Use the pinned ids while the spreadsheet still exists; otherwise search. */
async function resolveWorkspace(
  pinned: FinanceWorkspace | null,
): Promise<FinanceWorkspace> {
  if (pinned && (await isLiveFile(pinned.spreadsheetId))) {
    await migrateOnce(pinned.spreadsheetId);
    return pinned;
  }
  return ensureFinanceWorkspace();
}

function readPinned(
  raw: string | undefined,
  userKey: string,
): FinanceWorkspace | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<FinanceWorkspace> & { u?: string };
    if (
      value.u !== userKey ||
      !value.rootFolderId ||
      !value.spreadsheetId ||
      !value.receiptsFolderId ||
      !value.reportsFolderId
    ) {
      return null;
    }
    return {
      rootFolderId: value.rootFolderId,
      spreadsheetId: value.spreadsheetId,
      receiptsFolderId: value.receiptsFolderId,
      reportsFolderId: value.reportsFolderId,
    };
  } catch {
    return null;
  }
}

function sameWorkspace(
  a: FinanceWorkspace | null,
  b: FinanceWorkspace,
): boolean {
  return (
    a?.rootFolderId === b.rootFolderId &&
    a.spreadsheetId === b.spreadsheetId &&
    a.receiptsFolderId === b.receiptsFolderId &&
    a.reportsFolderId === b.reportsFolderId
  );
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
