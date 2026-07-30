import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, isAppError } from "@/lib/errors";
import type { ApiResponse } from "@/types/api";

/** Wrap a successful payload in the standard envelope. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, init);
}

/**
 * Convert any thrown value into a consistent error response. Zod validation
 * errors and `AppError`s are mapped precisely; everything else becomes a 500.
 */
export function fail(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json<ApiResponse<never>>(
      {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "The submitted data is invalid.",
          details: error.flatten().fieldErrors as Record<string, string[]>,
        },
      },
      { status: 422 },
    );
  }

  if (isAppError(error)) {
    return NextResponse.json<ApiResponse<never>>(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  // Unknown error: never leak internals to the client.
  console.error("[api] unhandled error", error);
  const fallback = AppError.internal();
  return NextResponse.json<ApiResponse<never>>(
    {
      ok: false,
      error: { code: fallback.code, message: fallback.message },
    },
    { status: fallback.status },
  );
}
