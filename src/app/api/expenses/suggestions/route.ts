import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { getEntrySuggestions } from "@/lib/services/expense.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await getEntrySuggestions());
  } catch (error) {
    return fail(error);
  }
}
