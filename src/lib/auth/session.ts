import "server-only";
import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import type { Session } from "next-auth";

/**
 * Return the current session or throw `UNAUTHENTICATED`. Used at the top of
 * every protected route handler so unauthenticated / expired requests fail
 * fast with a consistent 401.
 */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user || session.error === "RefreshAccessTokenError") {
    throw AppError.unauthenticated();
  }
  return session;
}
