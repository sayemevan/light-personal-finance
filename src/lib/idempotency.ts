import "server-only";
import type { NextRequest } from "next/server";

/** Must match IDEMPOTENCY_HEADER / REPLAY_HEADER in `@/lib/offline-queue`. */
const IDEMPOTENCY_HEADER = "idempotency-key";
const REPLAY_HEADER = "x-offline-replay";
const KEY_PATTERN = /^offline_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export interface CreateOptions {
  /** Id to store the new record under (from the client's key). */
  id?: string;
  /** The request is a queue replay: return the record if it already exists. */
  ifAbsent?: boolean;
}

/**
 * Read the client's idempotency key for a create. The record is stored
 * under the key's UUID, so a create sent twice (a lost response, then a
 * replay) can be recognised instead of saved twice.
 */
export function createOptions(req: NextRequest): CreateOptions {
  const match = KEY_PATTERN.exec(req.headers.get(IDEMPOTENCY_HEADER) ?? "");
  if (!match) return {};
  return {
    id: match[1]!.toLowerCase(),
    ifAbsent: req.headers.get(REPLAY_HEADER) === "1",
  };
}
