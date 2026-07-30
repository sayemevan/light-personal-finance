import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { getDashboardSummary } from "@/lib/services/dashboard.service";

/** Aggregated dashboard payload built from a single batched Sheets read. */
export async function GET() {
  try {
    await requireSession();
    return ok(await getDashboardSummary());
  } catch (error) {
    return fail(error);
  }
}
