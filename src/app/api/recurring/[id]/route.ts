import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateRecurringSchema } from "@/lib/schemas";
import {
  deleteRecurring,
  resolveToday,
  updateRecurring,
} from "@/lib/services/recurring.service";

type Params = { params: Promise<{ id: string }> };

/** The client may send its local date so schedule maths uses the user's day. */
const patchSchema = updateRecurringSchema.extend({
  /** `null` clears the end date. */
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format")
    .nullable()
    .optional(),
  today: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const { today, ...input } = patchSchema.parse(await req.json());
    return ok(await updateRecurring(id, input, resolveToday(today)));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteRecurring(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
