import "server-only";
import { getSheetsClient } from "@/lib/google/client";
import { AppError } from "@/lib/errors";

/** Cell primitives Google Sheets accepts on write. */
export type Cell = string | number | boolean;

/** Translates a domain entity to/from a spreadsheet row. */
export interface RowCodec<T> {
  toRow(entity: T): Cell[];
  fromRow(row: string[]): T;
}

/** Read helpers that tolerate missing / short rows. */
export const cell = {
  str(value: string | undefined): string {
    return value ?? "";
  },
  optional(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  },
  num(value: string | undefined): number {
    const parsed = Number.parseFloat(value ?? "");
    return Number.isFinite(parsed) ? parsed : 0;
  },
  optionalNum(value: string | undefined): number | undefined {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  },
  bool(value: string | undefined): boolean {
    return value === "TRUE" || value === "true";
  },
};

/** Convert a 1-based column count to an A1 column letter (e.g. 11 -> "K"). */
function columnLetter(count: number): string {
  let n = count;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

// Bumped on every write so read caches (see ledger.service) can tell when a
// spreadsheet changed underneath them within this server instance.
const writeGeneration = new Map<string, number>();

export function spreadsheetGeneration(spreadsheetId: string): number {
  return writeGeneration.get(spreadsheetId) ?? 0;
}

function markWritten(spreadsheetId: string): void {
  writeGeneration.set(spreadsheetId, spreadsheetGeneration(spreadsheetId) + 1);
}

/** Typed cell for `appendCells`; never parsed, so text can't become a formula. */
function toCellData(value: Cell) {
  if (typeof value === "number") return { userEnteredValue: { numberValue: value } };
  if (typeof value === "boolean") return { userEnteredValue: { boolValue: value } };
  return { userEnteredValue: { stringValue: value } };
}

// Cache the numeric sheetId per (spreadsheet, tab) — needed for row deletion.
const sheetIdCache = new Map<string, number>();

async function getSheetId(
  spreadsheetId: string,
  title: string,
): Promise<number> {
  const cacheKey = `${spreadsheetId}:${title}`;
  const cached = sheetIdCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });

  let found: number | undefined;
  for (const sheet of res.data.sheets ?? []) {
    const props = sheet.properties;
    if (props?.title && typeof props.sheetId === "number") {
      sheetIdCache.set(`${spreadsheetId}:${props.title}`, props.sheetId);
      if (props.title === title) found = props.sheetId;
    }
  }

  if (found === undefined) {
    throw AppError.internal(`Worksheet "${title}" was not found.`);
  }
  return found;
}

/**
 * Generic data-access object for a single worksheet whose first column is the
 * record id. All module services are built on top of this so the row-plumbing
 * lives in exactly one place.
 *
 * Rows never move. Deleting a record blanks its row instead of removing it
 * (blank rows are skipped on read) and new rows are added after the last
 * non-empty row, so a row number found by one request stays valid while other
 * requests write concurrently, even on other server instances. Physically
 * deleting rows would shift everything below and make concurrent edits land
 * on the wrong record.
 */
export class SheetRepository<T extends { id: string }> {
  private readonly lastColumn: string;

  constructor(
    private readonly tab: string,
    private readonly columnCount: number,
    private readonly codec: RowCodec<T>,
  ) {
    this.lastColumn = columnLetter(columnCount);
  }

  /** A1 range covering all data rows (row 1 holds headers). */
  get dataRange(): string {
    return `${this.tab}!A2:${this.lastColumn}`;
  }

  /** Decode raw rows (as returned for `dataRange`) into entities. */
  parse(rows: string[][]): T[] {
    return rows
      .filter((row) => row[0]?.trim())
      .map((row) => this.codec.fromRow(row));
  }

  toRow(entity: T): Cell[] {
    return this.codec.toRow(entity);
  }

  async list(spreadsheetId: string): Promise<T[]> {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: this.dataRange,
    });
    return this.parse((res.data.values as string[][]) ?? []);
  }

  async findById(spreadsheetId: string, id: string): Promise<T | null> {
    const entry = await this.findEntry(spreadsheetId, id);
    return entry?.entity ?? null;
  }

  async create(spreadsheetId: string, entity: T): Promise<T> {
    await this.appendMany(spreadsheetId, [entity]);
    return entity;
  }

  /**
   * Add rows after the last non-empty row. `appendCells` (unlike
   * `values.append`, whose table detection can stop at a blank row and insert
   * mid-sheet) never shifts existing rows. Cells are typed, never parsed, so
   * text like "=..." or "+880..." is stored exactly as entered.
   */
  async appendMany(spreadsheetId: string, entities: T[]): Promise<void> {
    if (entities.length === 0) return;
    const sheetId = await getSheetId(spreadsheetId, this.tab);
    const sheets = await getSheetsClient();
    markWritten(spreadsheetId);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [this.appendCellsRequest(sheetId, entities)] },
    });
    markWritten(spreadsheetId);
  }

  /**
   * In one atomic batch, blank the rows holding `ids` and append `entities`.
   * Rows added by other requests meanwhile are untouched, and a failure
   * changes nothing.
   */
  async removeIdsAndAppend(
    spreadsheetId: string,
    ids: ReadonlySet<string>,
    entities: T[],
  ): Promise<void> {
    const rowIndexes = (await this.idColumn(spreadsheetId))
      .map((id, i) => (id && ids.has(id) ? i + 1 : -1))
      .filter((index) => index >= 0);
    if (rowIndexes.length === 0 && entities.length === 0) return;

    const sheetId = await getSheetId(spreadsheetId, this.tab);
    const sheets = await getSheetsClient();
    markWritten(spreadsheetId);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          ...this.clearRowsRequests(sheetId, rowIndexes),
          ...(entities.length > 0
            ? [this.appendCellsRequest(sheetId, entities)]
            : []),
        ],
      },
    });
    markWritten(spreadsheetId);
  }

  /**
   * For each of `ids` stored in more than one row, blank every copy but the
   * first. Used after writes that two instances may both make (recurring
   * posts, archive rollups): both pick the same rows to clear, so running it
   * concurrently is safe.
   */
  async keepFirstOf(
    spreadsheetId: string,
    ids: ReadonlySet<string>,
  ): Promise<number> {
    if (ids.size === 0) return 0;
    const seen = new Set<string>();
    const duplicates: number[] = [];
    (await this.idColumn(spreadsheetId)).forEach((id, i) => {
      if (!id || !ids.has(id)) return;
      if (seen.has(id)) duplicates.push(i + 1);
      else seen.add(id);
    });
    if (duplicates.length === 0) return 0;

    const sheetId = await getSheetId(spreadsheetId, this.tab);
    const sheets = await getSheetsClient();
    markWritten(spreadsheetId);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: this.clearRowsRequests(sheetId, duplicates) },
    });
    markWritten(spreadsheetId);
    return duplicates.length;
  }

  async update(
    spreadsheetId: string,
    id: string,
    patch: Partial<T>,
  ): Promise<T> {
    const entry = await this.findEntry(spreadsheetId, id);
    if (!entry) throw AppError.notFound();

    const merged = { ...entry.entity, ...patch, id } as T;
    const sheets = await getSheetsClient();
    markWritten(spreadsheetId);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.tab}!A${entry.rowNumber}:${this.lastColumn}${entry.rowNumber}`,
      // RAW: stored as sent, so user text is never turned into a formula.
      valueInputOption: "RAW",
      requestBody: { values: [this.codec.toRow(merged)] },
    });
    markWritten(spreadsheetId);
    return merged;
  }

  /** Blank the record's row; see the class comment for why it isn't deleted. */
  async remove(spreadsheetId: string, id: string): Promise<void> {
    const entry = await this.findEntry(spreadsheetId, id);
    if (!entry) throw AppError.notFound();

    const sheets = await getSheetsClient();
    markWritten(spreadsheetId);
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${this.tab}!A${entry.rowNumber}:${this.lastColumn}${entry.rowNumber}`,
    });
    markWritten(spreadsheetId);
  }

  /** Column A of every data row (index 0 = sheet row 2); "" for blank rows. */
  private async idColumn(spreadsheetId: string): Promise<string[]> {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${this.tab}!A2:A`,
    });
    return ((res.data.values as string[][] | undefined) ?? []).map(
      (row) => row?.[0] ?? "",
    );
  }

  private appendCellsRequest(sheetId: number, entities: T[]) {
    return {
      appendCells: {
        sheetId,
        rows: entities.map((entity) => ({
          values: this.codec.toRow(entity).map(toCellData),
        })),
        fields: "userEnteredValue",
      },
    };
  }

  /** Requests blanking the given 0-based sheet rows, merged into runs. */
  private clearRowsRequests(sheetId: number, rowIndexes: number[]) {
    const runs: { start: number; end: number }[] = [];
    for (const index of [...rowIndexes].sort((a, b) => a - b)) {
      const last = runs[runs.length - 1];
      if (last && last.end === index) last.end = index + 1;
      else runs.push({ start: index, end: index + 1 });
    }
    // updateCells with no row data and a field mask clears those values.
    return runs.map((run) => ({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: run.start,
          endRowIndex: run.end,
          startColumnIndex: 0,
          endColumnIndex: this.columnCount,
        },
        fields: "userEnteredValue",
      },
    }));
  }

  /** Locate a record and the 1-based sheet row it occupies. */
  private async findEntry(
    spreadsheetId: string,
    id: string,
  ): Promise<{ entity: T; rowNumber: number } | null> {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: this.dataRange,
    });
    const rows = (res.data.values as string[][]) ?? [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (row && row[0] === id) {
        return {
          entity: this.codec.fromRow(row),
          // +2: skip the header row and convert to 1-based.
          rowNumber: index + 2,
        };
      }
    }
    return null;
  }
}
