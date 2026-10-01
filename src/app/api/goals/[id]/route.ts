import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateGoalSchema } from "@/lib/schemas";
import {
  deleteGoal,
  getGoal,
  updateGoal,
  type GoalUpdateInput,
} from "@/lib/services/goal.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    return ok(await getGoal(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    // `targetDate: ""` / `null` clears the date; the schema only accepts a
    // real date, so strip it before parsing and re-apply the clear after.
    const clearTargetDate =
      "targetDate" in body && (body.targetDate === "" || body.targetDate === null);
    if (clearTargetDate) delete body.targetDate;
    const input: GoalUpdateInput = updateGoalSchema.parse(body);
    if (clearTargetDate) input.targetDate = undefined;
    return ok(await updateGoal(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteGoal(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
