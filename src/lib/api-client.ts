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
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) {
    throw new ApiClientError(json.error);
  }
  return json.data;
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
  const json = (await res.json()) as ApiResponse<{ fileId: string }>;
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
