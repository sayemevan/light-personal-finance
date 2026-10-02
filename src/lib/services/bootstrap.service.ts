import "server-only";
import {
  getWorkspaceForCurrentUser,
  type FinanceWorkspace,
} from "@/lib/google/workspace";

export type { FinanceWorkspace };

/**
 * Idempotently ensure the user's Drive structure and Finance spreadsheet exist.
 * Delegates to the workspace module (the single source of truth) and is safe to
 * call repeatedly. The client calls it before its first data request so the
 * workspace is created once and pinned in a cookie for every later request.
 */
export async function ensureWorkspace(): Promise<FinanceWorkspace> {
  return getWorkspaceForCurrentUser();
}
