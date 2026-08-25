import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { getArchiveYears } from "@/lib/services/history.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await getArchiveYears());
  } catch (error) {
    return fail(error);
  }
}
