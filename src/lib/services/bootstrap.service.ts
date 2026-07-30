import "server-only";
import {
  ensureFinanceWorkspace,
  type FinanceWorkspace,
} from "@/lib/google/workspace";

export type { FinanceWorkspace };

/**
 * Idempotently ensure the user's Drive structure and Finance spreadsheet exist.
 * Delegates to the workspace module (the single source of truth) and is safe to
 * call repeatedly — typically invoked once right after first sign-in.
 */
export async function ensureWorkspace(): Promise<FinanceWorkspace> {
  return ensureFinanceWorkspace();
}
