import { toast } from "sonner";

import {
  enqueue,
  isNetworkError,
  isOffline,
  isQueueable,
  type QueuedMethod,
} from "@/lib/offline-queue";
import type { ApiResponse, ApiErrorBody } from "@/types/api";

/** Error thrown by the API client carrying the server's structured error. */
export class ApiClientError extends Error {
  readonly code: string;
  readonly details?: Record<string, string[]>;

  constructor(error: ApiErrorBody) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.details = error.details;
  }
}

/**
 * Thin fetch wrapper that unwraps the `{ ok, data | error }` envelope and
 * throws a typed `ApiClientError` on failure. All client data hooks use this.
 *
 * Writes to expenses / income / transfers made while offline are queued (see
 * `@/lib/offline-queue`) and resolve with a placeholder record instead of
 * failing; `OfflineSync` replays them once the connection is back.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const queueable =
    isQueueable(method, path) &&
    (init?.body === undefined || typeof init.body === "string");

  if (queueable && isOffline()) {
    const placeholder = queueOffline<T>(method, path, init?.body);
    if (placeholder.queued) return placeholder.value;
  }

  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
  } catch (error) {
    if (queueable && isNetworkError(error)) {
      const placeholder = queueOffline<T>(method, path, init?.body);
      if (placeholder.queued) return placeholder.value;
    }
    throw error;
  }

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON body (e.g. an offline page or proxy error).
    throw new ApiClientError({
      code: res.status === 503 ? "OFFLINE" : "BAD_RESPONSE",
      message:
        res.status === 503
          ? "You're offline and this data isn't available yet."
          : "Unexpected response from the server.",
    });
  }
  if (!json.ok) {
    throw new ApiClientError(json.error);
  }
  return json.data;
}

/**
 * Store a write in the offline queue and build a placeholder result so the
 * calling mutation completes. POST/PATCH echo the submitted fields with a
 * temporary id; DELETE echoes the id from the path.
 */
function queueOffline<T>(
  method: string,
  path: string,
  body: BodyInit | null | undefined,
): { queued: true; value: T } | { queued: false } {
  const text = typeof body === "string" ? body : undefined;
  const item = enqueue(method as QueuedMethod, path, text);
  if (!item) return { queued: false };

  toast.info("Saved offline — will sync when you're back online");

  let fields: Record<string, unknown> = {};
  try {
    const parsed = text ? (JSON.parse(text) as unknown) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      fields = parsed as Record<string, unknown>;
    }
  } catch {
    // Body wasn't JSON; the placeholder just carries the id.
  }
  const pathId = path.split("?")[0]?.split("/")[3];
  const now = new Date(item.createdAt).toISOString();
  const value =
    method === "POST"
      ? { ...fields, id: item.tempId, createdAt: now, pendingSync: true }
      : { ...fields, id: pathId ?? item.tempId, pendingSync: true };
  return { queued: true, value: value as T };
}

/**
 * Upload a receipt file via multipart/form-data. We deliberately do not set
 * `Content-Type` so the browser adds the correct multipart boundary.
 */
export async function uploadReceiptFile(
  file: File,
): Promise<{ fileId: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/receipts", { method: "POST", body: form });
  let json: ApiResponse<{ fileId: string }>;
  try {
    json = (await res.json()) as ApiResponse<{ fileId: string }>;
  } catch {
    // e.g. a 413 from the host before the route runs.
    throw new Error(
      res.status === 413
        ? "Receipt is too large to upload."
        : `Receipt upload failed (${res.status}).`,
    );
  }
  if (!json.ok) {
    throw new ApiClientError(json.error);
  }
  return json.data;
}

/** Convenience helpers for common verbs. */
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
