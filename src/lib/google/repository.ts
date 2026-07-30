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
  private get dataRange(): string {
    return `${this.tab}!A2:${this.lastColumn}`;
  }

  async list(spreadsheetId: string): Promise<T[]> {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: this.dataRange,
    });
    const rows = (res.data.values as string[][]) ?? [];
    return rows
      .filter((row) => row[0]?.trim())
      .map((row) => this.codec.fromRow(row));
  }

  async findById(spreadsheetId: string, id: string): Promise<T | null> {
    const entry = await this.findEntry(spreadsheetId, id);
    return entry?.entity ?? null;
  }

  async create(spreadsheetId: string, entity: T): Promise<T> {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${this.tab}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [this.codec.toRow(entity)] },
    });
    return entity;
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
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.tab}!A${entry.rowNumber}:${this.lastColumn}${entry.rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [this.codec.toRow(merged)] },
    });
    return merged;
  }

  async remove(spreadsheetId: string, id: string): Promise<void> {
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
