import "server-only";
import { google } from "googleapis";
import { auth } from "@/auth";
import { AppError } from "@/lib/errors";

/**
 * Build an OAuth2 client authenticated as the currently signed-in user.
 *
 * Tokens live only in the encrypted session cookie and are read here on the
 * server — they are never exposed to the browser. If the session is missing or
 * a refresh has failed, we throw an `UNAUTHENTICATED` error so callers can
 * force a re-login.
 */
export async function getUserOAuthClient() {
  const session = await auth();

  if (!session || session.error === "RefreshAccessTokenError") {
    throw AppError.unauthenticated("Your session has expired. Please sign in again.");
  }

  if (!session.accessToken) {
    throw AppError.unauthenticated("Missing Google access token.");
  }

  const client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  );
  client.setCredentials({ access_token: session.accessToken });
  return client;
}

/** Authenticated Google Sheets API client for the current user. */
export async function getSheetsClient() {
  const authClient = await getUserOAuthClient();
  return google.sheets({ version: "v4", auth: authClient });
}

/** Authenticated Google Drive API client for the current user. */
export async function getDriveClient() {
  const authClient = await getUserOAuthClient();
  return google.drive({ version: "v3", auth: authClient });
}
