/**
 * Offline write queue. Creates / edits / deletes of expenses, income and
 * transfers made while the device is offline are stored in localStorage and
 * replayed, in order, once the connection is back. Every storage access is
 * guarded: private windows or blocked storage simply disable queueing.
 */

const STORAGE_KEY = "pf.offline-queue.v1";
/** Window event fired whenever the queue's contents change. */
export const OFFLINE_QUEUE_EVENT = "pf:offline-queue-change";
/** Permanent (4xx) failures after which an item is dropped. */
const MAX_PERMANENT_FAILURES = 3;
/** Prefix of client-generated ids, so later requests can be re-pointed. */
const TEMP_ID_PREFIX = "offline_";

export type QueuedMethod = "POST" | "PATCH" | "DELETE";

export interface QueuedRequest {
  /** Client-generated id; also used as the placeholder record id on POST. */
  tempId: string;
  method: QueuedMethod;
  path: string;
  /** JSON-encoded request body, if any. */
  body?: string;
  /** Epoch ms when the request was queued. */
  createdAt: number;
  /** Number of permanent (4xx) failures seen so far. */
  failures: number;
}

export interface FlushResult {
  synced: number;
  dropped: QueuedRequest[];
  /** Items still queued (network still down, or server errors). */
  remaining: number;
}

const QUEUEABLE_PATH = /^\/api\/(expenses|income|transfers)(\/[^/?#]+)?\/?(\?.*)?$/;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Whether a request of this method/path may be queued while offline. */
export function isQueueable(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  if (verb !== "POST" && verb !== "PATCH" && verb !== "DELETE") return false;
  let pathname = path;
  try {
    if (isBrowser()) {
      const url = new URL(path, window.location.origin);
      if (url.origin !== window.location.origin) return false;
      pathname = url.pathname + url.search;
    }
  } catch {
    return false;
  }
  return QUEUEABLE_PATH.test(pathname);
}

/** True when the browser reports it has no network connection. */
export function isOffline(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "onLine" in navigator &&
    navigator.onLine === false
  );
}

/** Whether a thrown fetch error means "couldn't reach the network". */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

export function generateTempId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${TEMP_ID_PREFIX}${random}`;
}

export function readQueue(): QueuedRequest[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueuedRequest[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedRequest[]): boolean {
  if (!isBrowser()) return false;
  try {
    if (items.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    return false;
  }
  try {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
  } catch {
    // ignore
  }
  return true;
}

/** Number of writes waiting to be synced. */
export function queueSize(): number {
  return readQueue().length;
}

/**
 * Append a request to the queue. Returns the stored item, or `null` when
 * storage is unavailable (the caller should then surface the original error).
 */
export function enqueue(
  method: QueuedMethod,
  path: string,
  body?: string,
): QueuedRequest | null {
  const item: QueuedRequest = {
    tempId: generateTempId(),
    method,
    path,
    body,
    createdAt: Date.now(),
    failures: 0,
  };
  return writeQueue([...readQueue(), item]) ? item : null;
}

/** Forget every queued write (e.g. on sign-out). */
export function clearQueue(): void {
  writeQueue([]);
}

/**
 * Replace temp ids (from POSTs queued earlier and since synced) with the real
 * ids the server assigned, both in the path and anywhere in the body.
 */
function remapIds(value: string, idMap: Map<string, string>): string {
  if (idMap.size === 0 || !value.includes(TEMP_ID_PREFIX)) return value;
  let out = value;
  for (const [tempId, realId] of idMap) {
    out = out.split(tempId).join(realId);
  }
  return out;
}

/**
 * 4xx responses that retrying won't fix. Expired sessions (401), timeouts
 * (408) and rate limiting (429) are treated as transient.
 */
function isPermanentFailure(status: number): boolean {
  return (
    status >= 400 &&
    status < 500 &&
    status !== 401 &&
    status !== 408 &&
    status !== 429
  );
}

let flushing: Promise<FlushResult> | null = null;

/**
 * Replay queued writes in order. Stops at the first network or server error
 * (keeping that item and everything after it); permanent 4xx responses count
 * towards dropping an item. Concurrent calls share one flush.
 */
export function flushQueue(): Promise<FlushResult> {
  if (!flushing) {
    flushing = runFlush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function runFlush(): Promise<FlushResult> {
  const result: FlushResult = { synced: 0, dropped: [], remaining: 0 };
  if (!isBrowser() || isOffline()) {
    result.remaining = queueSize();
    return result;
  }

  const idMap = new Map<string, string>();
  const processed = new Set<string>();
  const updated = new Map<string, QueuedRequest>();
  const snapshot = readQueue();

  for (const item of snapshot) {
    const path = remapIds(item.path, idMap);
    const body = item.body ? remapIds(item.body, idMap) : undefined;

    let res: Response;
    try {
      res = await fetch(path, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body,
        // A redirect means the request never reached the API (e.g. sent to
        // sign-in); following it would make an HTML page look like success.
        redirect: "manual",
      });
    } catch {
      // Still offline / unreachable: keep this and every later item.
      break;
    }

    const isJson = (res.headers.get("content-type") ?? "").includes(
      "application/json",
    );
    if (res.type === "opaqueredirect" || (res.ok && !isJson)) {
      // Treat like an expired session: retry later, keep order.
      updated.set(item.tempId, { ...item, path, body });
      break;
    }

    if (res.ok) {
      processed.add(item.tempId);
      result.synced += 1;
      if (item.method === "POST") {
        try {
          const json = (await res.json()) as {
            ok?: boolean;
            data?: { id?: unknown };
          };
          const realId = json?.data?.id;
          if (typeof realId === "string" && realId) {
            idMap.set(item.tempId, realId);
          }
        } catch {
          // Non-JSON success: nothing to remap.
        }
      }
      continue;
    }

    if (isPermanentFailure(res.status)) {
      const failures = item.failures + 1;
      if (failures >= MAX_PERMANENT_FAILURES) {
        processed.add(item.tempId);
        result.dropped.push({ ...item, failures });
      } else {
        updated.set(item.tempId, { ...item, path, body, failures });
      }
      continue;
    }
    // 5xx / auth expired / rate limited: retry later. Stop here so later
    // writes (which may depend on this one) keep their order.
    updated.set(item.tempId, { ...item, path, body });
    break;
  }

  // Merge against the current queue so items added mid-flush are kept.
  const next = readQueue()
    .filter((item) => !processed.has(item.tempId))
    .map((item) => {
      const changed = updated.get(item.tempId);
      if (changed) return changed;
      // Later items that never ran still need their temp ids re-pointed.
      return {
        ...item,
        path: remapIds(item.path, idMap),
        body: item.body ? remapIds(item.body, idMap) : undefined,
      };
    });
  writeQueue(next);
  result.remaining = next.length;
  return result;
}

/** Describe a queued request for an error toast. */
export function describeQueued(item: QueuedRequest): string {
  const match = /^\/api\/(expenses|income|transfers)/.exec(item.path);
  const noun =
    match?.[1] === "income"
      ? "income"
      : match?.[1] === "transfers"
        ? "transfer"
        : "expense";
  const action =
    item.method === "POST"
      ? "add"
      : item.method === "PATCH"
        ? "update"
        : "delete";
  return `${action} ${noun}`;
}
