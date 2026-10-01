import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createBudgetSchema } from "@/lib/schemas";
import {
  createBudget,
  listBudgetStatuses,
} from "@/lib/services/budget.service";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const month = new URL(req.url).searchParams.get("month") || undefined;
    return ok(await listBudgetStatuses(month));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createBudgetSchema.parse(await req.json());
    const created = await createBudget(input);
    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
