import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { getAccountSummary } from "@/lib/services/report.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await getAccountSummary());
  } catch (error) {
    return fail(error);
  }
}
