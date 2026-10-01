import "server-only";
import { readRange, updateRange, appendRows } from "@/lib/google/sheets";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { SHEET_TABS } from "@/config/google";
import { noteSpreadsheetWrite } from "@/lib/google/repository";
import { loadLedger } from "@/lib/services/ledger.service";
import { DEFAULT_CURRENCY } from "@/config/defaults";

export interface AppSettings {
  currency: string;
}

/**
 * Whether `code` is an ISO 4217 currency `Intl.NumberFormat` can format.
 * Any malformed value (e.g. "1$ ") makes it throw a RangeError, which would
 * break every amount the app renders.
 */
export function isSupportedCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  const supported = (
    Intl as { supportedValuesOf?: (key: "currency") => string[] }
  ).supportedValuesOf?.("currency");
  return supported ? supported.includes(code) : true;
}

/** Read the Settings key/value tab into a typed object. */
export async function getSettings(): Promise<AppSettings> {
  // Comes with the ledger's batched read: no separate Sheets call.
  const rows = (await loadLedger()).settings;
  const map = new Map(rows.map((row) => [row[0], row[1] ?? ""]));
  return {
    // Guard against a bad value already saved (or typed into the sheet).
    currency: isSupportedCurrency(map.get("currency") ?? "")
      ? (map.get("currency") as string)
      : DEFAULT_CURRENCY,
  };
}

/** Upsert a single key/value setting. */
async function setSetting(key: string, value: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  const rows = await readRange(spreadsheetId, `${SHEET_TABS.settings}!A2:B`);
  const index = rows.findIndex((row) => row[0] === key);

  if (index === -1) {
    await appendRows(spreadsheetId, `${SHEET_TABS.settings}!A1`, [[key, value]]);
  } else {
    const rowNumber = index + 2;
    await updateRange(spreadsheetId, `${SHEET_TABS.settings}!B${rowNumber}`, [
      [value],
    ]);
  }
  noteSpreadsheetWrite(spreadsheetId);
}

export async function updateSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  if (patch.currency) {
    await setSetting("currency", patch.currency);
  }
  return getSettings();
}
