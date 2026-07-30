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
