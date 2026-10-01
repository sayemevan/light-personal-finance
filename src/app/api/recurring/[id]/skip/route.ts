import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { skipOccurrence } from "@/lib/services/recurring.service";

type Params = { params: Promise<{ id: string }> };

const skipSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Advance the rule past its next occurrence without posting it. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    return ok(await skipOccurrence(id, skipSchema.parse(body ?? {})));
  } catch (error) {
    return fail(error);
  }
}
