import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { getMonthlyIncome } from "@/lib/services/report.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await getMonthlyIncome());
  } catch (error) {
    return fail(error);
  }
}
