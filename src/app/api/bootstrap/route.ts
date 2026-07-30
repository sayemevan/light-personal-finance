import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { ensureWorkspace } from "@/lib/services/bootstrap.service";

/**
 * Idempotently ensure the user's Drive folders and Finance spreadsheet exist.
 * Safe to call repeatedly; typically invoked once right after first sign-in.
 */
export async function POST() {
  try {
    await requireSession();
    return ok(await ensureWorkspace());
  } catch (error) {
    return fail(error);
  }
}
