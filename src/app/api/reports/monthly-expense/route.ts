import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { reportYearQuerySchema } from "@/lib/schemas";
import { getMonthlyExpense } from "@/lib/services/report.service";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { year } = reportYearQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return ok(await getMonthlyExpense(year));
  } catch (error) {
    return fail(error);
  }
}
