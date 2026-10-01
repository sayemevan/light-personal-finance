import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { getSheetsClient } from "@/lib/google/client";
import { AppError } from "@/lib/errors";

/**
 * Mutual exclusion for writes to one spreadsheet, across requests and across
 * server instances.
 *
 * Sheets has no compare-and-set, but `addSheet` fails when a sheet with the
 * same title already exists, so creating a hidden `_lock_<name>` tab is an
 * atomic "acquire". Its A1 cell holds an expiry time so a lock left behind by
 * a crashed request is broken once it lapses. Inside one instance a promise
 * chain queues callers first, so they don't poll Sheets against each other.
 *
 * Locks are re-entrant within one async call chain: code already holding a
 * lock can call code that takes the same lock.
 */

const LOCK_PREFIX = "_lock_";
const POLL_MS = 400;

export interface LockOptions {
  /** How long the lock is valid before others may break it. */
  ttlMs?: number;
  /** How long to wait for a busy lock before giving up. */
  waitMs?: number;
}

const held = new AsyncLocalStorage<ReadonlySet<string>>();
const localChains = new Map<string, Promise<unknown>>();

export async function withSpreadsheetLock<T>(
  spreadsheetId: string,
  name: string,
  fn: () => Promise<T>,
  { ttlMs = 30_000, waitMs = 25_000 }: LockOptions = {},
): Promise<T> {
  const key = `${spreadsheetId}:${name}`;
  const current = held.getStore();
  if (current?.has(key)) return fn();

  const run = () =>
    held.run(new Set([...(current ?? []), key]), async () => {
      const sheetId = await acquire(spreadsheetId, name, ttlMs, waitMs);
      try {
        return await fn();
      } finally {
        await release(spreadsheetId, sheetId).catch((error) =>
          console.error(`[lock] failed to release ${name}`, error),
        );
      }
    });

  const previous = localChains.get(key) ?? Promise.resolve();
  const chained = previous.catch(() => undefined).then(run);
  localChains.set(key, chained);
  try {
    return await chained;
  } finally {
    if (localChains.get(key) === chained) localChains.delete(key);
  }
}

async function acquire(
  spreadsheetId: string,
  name: string,
  ttlMs: number,
  waitMs: number,
): Promise<number> {
  const sheets = await getSheetsClient();
  const title = `${LOCK_PREFIX}${name}`;
  const deadline = Date.now() + waitMs;

  for (;;) {
    const sheetId = 1 + Math.floor(Math.random() * 2_000_000_000);
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  sheetId,
                  title,
                  hidden: true,
                  gridProperties: { rowCount: 1, columnCount: 1 },
                },
              },
            },
            {
              updateCells: {
                start: { sheetId, rowIndex: 0, columnIndex: 0 },
                rows: [
                  {
                    values: [
                      { userEnteredValue: { numberValue: Date.now() + ttlMs } },
                    ],
                  },
                ],
                fields: "userEnteredValue",
              },
            },
          ],
        },
      });
      return sheetId;
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
    }

    const existing = await readLock(spreadsheetId, title);
    if (!existing) continue; // released in the meantime
    if (Date.now() > existing.expiresAt) {
      // Holder died without releasing. Deleting by its sheetId (not title)
      // means two breakers can't delete a lock someone just re-acquired.
      await release(spreadsheetId, existing.sheetId).catch(() => undefined);
      continue;
    }
    if (Date.now() > deadline) {
      throw new AppError(
        "CONFLICT",
        "Another change is still being saved. Try again in a moment.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

async function readLock(
  spreadsheetId: string,
  title: string,
): Promise<{ sheetId: number; expiresAt: number } | null> {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheetId = meta.data.sheets?.find(
    (sheet) => sheet.properties?.title === title,
  )?.properties?.sheetId;
  if (typeof sheetId !== "number") return null;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const expiresAt = Number(res.data.values?.[0]?.[0]);
  // A1 is written in the same atomic batch as the sheet, so a missing value
  // means a foreign tab with this name: treat it as expired.
  return { sheetId, expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0 };
}

async function release(spreadsheetId: string, sheetId: number): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ deleteSheet: { sheetId } }] },
  });
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && /already exists/i.test(error.message);
}
