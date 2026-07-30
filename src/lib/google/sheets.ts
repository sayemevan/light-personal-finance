import "server-only";
import { getSheetsClient } from "@/lib/google/client";
import { AppError } from "@/lib/errors";

/**
 * Low-level Google Sheets helpers. These deal purely with reading and writing
 * cell ranges; mapping rows to domain objects lives in the service layer.
 *
 * NOTE: Business logic is intentionally not implemented yet. These wrappers
 * establish the integration surface the services will build on.
 */

/** Read a rectangular range and return the raw row/column values. */
export async function readRange(
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values as string[][]) ?? [];
}

/** Append one or more rows to the end of a range. */
export async function appendRows(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean)[][],
): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/** Overwrite the values in a specific range. */
export async function updateRange(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean)[][],
): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/** Read several ranges in a single request to minimise API round-trips. */
export async function batchReadRanges(
  spreadsheetId: string,
  ranges: string[],
): Promise<Record<string, string[][]>> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });
  const result: Record<string, string[][]> = {};
  for (const value of res.data.valueRanges ?? []) {
    if (value.range) {
      result[value.range] = (value.values as string[][]) ?? [];
    }
  }
  return result;
}

/** Guard used by services before they attempt any read/write. */
export function assertSpreadsheetId(spreadsheetId: string | undefined | null) {
  if (!spreadsheetId) {
    throw AppError.internal("The finance spreadsheet has not been initialised.");
  }
  return spreadsheetId;
}
