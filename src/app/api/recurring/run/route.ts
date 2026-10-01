import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { resolveToday, runDueRules } from "@/lib/services/recurring.service";

const runSchema = z.object({ today: z.string().optional() });

/** Post due auto-post occurrences and report those awaiting confirmation. */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json().catch(() => ({}));
    const { today } = runSchema.parse(body ?? {});
    return ok(await runDueRules(resolveToday(today)));
  } catch (error) {
    return fail(error);
  }
}
