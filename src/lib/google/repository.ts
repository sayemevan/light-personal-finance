import "server-only";
import { getSheetsClient } from "@/lib/google/client";
import { AppError } from "@/lib/errors";
import { withSpreadsheetLock } from "@/lib/google/lock";

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

/**
 * Lock held around anything that locates a row by position and then writes or
 * deletes it. Row deletions shift every row below, so without it a concurrent
 * delete can make an update or delete land on a different record.
 */
export const ROWS_LOCK = "rows";

export function withRowsLock<T>(
  spreadsheetId: string,
  fn: () => Promise<T>,
  options?: { ttlMs?: number; waitMs?: number },
): Promise<T> {
  return withSpreadsheetLock(spreadsheetId, ROWS_LOCK, fn, options);
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

  async appendMany(spreadsheetId: string, entities: T[]): Promise<void> {
    if (entities.length === 0) return;
    markWritten(spreadsheetId);
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${this.tab}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: entities.map((entity) => this.codec.toRow(entity)) },
    });
    markWritten(spreadsheetId);
  }

  /**
   * In one atomic batch, delete the rows holding `ids` and append `entities`.
   * Row positions are read fresh under the rows lock, so rows added by other
   * requests meanwhile are left alone, and a failure changes nothing.
   */
  async removeIdsAndAppend(
    spreadsheetId: string,
    ids: ReadonlySet<string>,
    entities: T[],
  ): Promise<void> {
    await withRowsLock(spreadsheetId, async () => {
      const sheets = await getSheetsClient();
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${this.tab}!A2:A`,
      });
      const column = (res.data.values as string[][] | undefined) ?? [];

      // 0-based sheet indexes (row 1 is the header), merged into contiguous
      // runs and deleted bottom-up so earlier deletes don't shift later ones.
      const indexes = column
        .map((row, i) => (row?.[0] && ids.has(row[0]) ? i + 1 : -1))
        .filter((index) => index >= 0);
      const runs: { start: number; end: number }[] = [];
      for (const index of indexes) {
        const last = runs[runs.length - 1];
        if (last && last.end === index) last.end = index + 1;
        else runs.push({ start: index, end: index + 1 });
      }
      if (runs.length === 0 && entities.length === 0) return;

      const sheetId = await getSheetId(spreadsheetId, this.tab);
      markWritten(spreadsheetId);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            ...runs.reverse().map((run) => ({
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: run.start,
                  endIndex: run.end,
                },
              },
            })),
            ...(entities.length > 0
              ? [
                  {
                    appendCells: {
                      sheetId,
                      rows: entities.map((entity) => ({
                        values: this.codec.toRow(entity).map(toCellData),
                      })),
                      fields: "userEnteredValue",
                    },
                  },
                ]
              : []),
          ],
        },
      });
      markWritten(spreadsheetId);
    });
  }

  async update(
    spreadsheetId: string,
    id: string,
    patch: Partial<T>,
  ): Promise<T> {
    return withRowsLock(spreadsheetId, async () => {
      const entry = await this.findEntry(spreadsheetId, id);
      if (!entry) throw AppError.notFound();

      const merged = { ...entry.entity, ...patch, id } as T;
      const sheets = await getSheetsClient();
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${this.tab}!A${entry.rowNumber}:${this.lastColumn}${entry.rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [this.codec.toRow(merged)] },
      });
      markWritten(spreadsheetId);
      return merged;
    });
  }

  async remove(spreadsheetId: string, id: string): Promise<void> {
    await withRowsLock(spreadsheetId, async () => {
      const entry = await this.findEntry(spreadsheetId, id);
      if (!entry) throw AppError.notFound();

      const sheetId = await getSheetId(spreadsheetId, this.tab);
      const sheets = await getSheetsClient();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: entry.rowNumber - 1,
                  endIndex: entry.rowNumber,
                },
              },
            },
          ],
        },
      });
      markWritten(spreadsheetId);
    });
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
