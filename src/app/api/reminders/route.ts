import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { getReminders } from "@/lib/services/reminder.service";

/** Upcoming / overdue items to notify about, derived from the ledger. */
export async function GET() {
  try {
    await requireSession();
    return ok(await getReminders());
  } catch (error) {
    return fail(error);
  }
}
