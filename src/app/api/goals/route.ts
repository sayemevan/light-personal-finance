import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createGoalSchema } from "@/lib/schemas";
import { createGoal, listGoals } from "@/lib/services/goal.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await listGoals());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = (await req.json()) as Record<string, unknown>;
    // An empty date input means "no target date".
    if (!body.targetDate) delete body.targetDate;
    const input = createGoalSchema.parse(body);
    const created = await createGoal(input);
    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
