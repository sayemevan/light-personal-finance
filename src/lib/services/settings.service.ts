import "server-only";
import { readRange, updateRange, appendRows } from "@/lib/google/sheets";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { SHEET_TABS } from "@/config/google";
import { DEFAULT_CURRENCY } from "@/config/defaults";

export interface AppSettings {
  currency: string;
}

/** Read the Settings key/value tab into a typed object. */
export async function getSettings(): Promise<AppSettings> {
  const spreadsheetId = await getSpreadsheetId();
  const rows = await readRange(spreadsheetId, `${SHEET_TABS.settings}!A2:B`);
  const map = new Map(rows.map((row) => [row[0], row[1] ?? ""]));
  return {
    currency: map.get("currency") || DEFAULT_CURRENCY,
  };
}

/** Upsert a single key/value setting. */
async function setSetting(key: string, value: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  const rows = await readRange(spreadsheetId, `${SHEET_TABS.settings}!A2:B`);
  const index = rows.findIndex((row) => row[0] === key);

  if (index === -1) {
    await appendRows(spreadsheetId, `${SHEET_TABS.settings}!A1`, [[key, value]]);
    return;
  }
  const rowNumber = index + 2;
  await updateRange(spreadsheetId, `${SHEET_TABS.settings}!B${rowNumber}`, [
    [value],
  ]);
}

export async function updateSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  if (patch.currency) {
    await setSetting("currency", patch.currency);
  }
  return getSettings();
}
