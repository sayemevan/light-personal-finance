/**
 * Shared response contracts for the HTTP API. Every route handler returns one
 * of these shapes so the client can handle success and failure uniformly.
 */

export interface ApiErrorBody {
  code: string;
  message: string;
  /** Optional field-level validation details. */
  details?: Record<string, string[]>;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody };

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ArchiveYearSummary {
  year: string;
  total: number;
  rowCount: number;
}

export interface ArchiveResult {
  kind: "expense" | "income";
  years: ArchiveYearSummary[];
  archivedCount: number;
  rollupCount: number;
}
