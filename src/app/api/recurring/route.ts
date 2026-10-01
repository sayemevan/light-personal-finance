import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createRecurringSchema } from "@/lib/schemas";
import {
  createRecurring,
  listRecurring,
} from "@/lib/services/recurring.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await listRecurring());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createRecurringSchema.parse(await req.json());
    const created = await createRecurring(input);
    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
