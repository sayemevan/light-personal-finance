import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import {
  confirmOccurrence,
  resolveToday,
} from "@/lib/services/recurring.service";

type Params = { params: Promise<{ id: string }> };

const confirmSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format"),
  amount: z.coerce.number().finite().positive("Amount must be positive").optional(),
  today: z.string().optional(),
});

/** Post the rule's next occurrence (optionally overriding the amount). */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const { today, ...input } = confirmSchema.parse(await req.json());
    return ok(await confirmOccurrence(id, input, resolveToday(today)));
  } catch (error) {
    return fail(error);
  }
}
