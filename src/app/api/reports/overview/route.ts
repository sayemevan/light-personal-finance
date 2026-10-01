import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { yearSchema } from "@/lib/schemas";
import { getOverview } from "@/lib/services/report.service";

const overviewQuerySchema = z.object({
  year: yearSchema,
  month: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .default(new Date().getMonth() + 1),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { year, month } = overviewQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return ok(await getOverview(year, month));
  } catch (error) {
    return fail(error);
  }
}
