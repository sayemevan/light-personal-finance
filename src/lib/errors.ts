/**
 * Centralised error taxonomy. The service layer throws `AppError`s; route
 * handlers translate them into consistent HTTP responses via `toApiError`.
 */

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "GOOGLE_API"
  | "NOT_IMPLEMENTED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  GOOGLE_API: 502,
  NOT_IMPLEMENTED: 501,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { details?: Record<string, string[]>; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options?.details;
  }

  static unauthenticated(message = "You must be signed in.") {
    return new AppError("UNAUTHENTICATED", message);
  }

  static notFound(message = "Resource not found.") {
    return new AppError("NOT_FOUND", message);
  }

  static validation(
    message = "The submitted data is invalid.",
    details?: Record<string, string[]>,
  ) {
    return new AppError("VALIDATION", message, { details });
  }

  static notImplemented(message = "Not implemented yet.") {
    return new AppError("NOT_IMPLEMENTED", message);
  }

  static internal(message = "Something went wrong.", cause?: unknown) {
    return new AppError("INTERNAL", message, { cause });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Translate an error thrown by a Google API client (gaxios) into an
 * `AppError`, or null if it isn't one. Google signals rate limits with 429 or
 * with 403 + a rate-limit reason, so both map to RATE_LIMITED.
 */
export function fromGoogleError(error: unknown): AppError | null {
  if (!(error instanceof Error)) return null;
  const response = (error as { response?: { status?: unknown } }).response;
  const status = typeof response?.status === "number" ? response.status : null;
  if (status === null) return null;

  const message = error.message;
  const rateLimited =
    status === 429 || (status === 403 && /rate ?limit|quota/i.test(message));
  if (rateLimited) {
    return new AppError(
      "RATE_LIMITED",
      "Google is limiting requests right now. Try again in a minute.",
      { cause: error },
    );
  }
  if (status === 401) {
    return new AppError(
      "UNAUTHENTICATED",
      "Your Google sign-in expired. Sign in again.",
      { cause: error },
    );
  }
  if (status === 403) {
    return new AppError("FORBIDDEN", "Google denied access to this file.", {
      cause: error,
    });
  }
  if (status === 404) {
    return new AppError("NOT_FOUND", "Not found in your Google Drive.", {
      cause: error,
    });
  }
  return new AppError(
    "GOOGLE_API",
    "Google Sheets or Drive returned an error. Try again.",
    { cause: error },
  );
}
