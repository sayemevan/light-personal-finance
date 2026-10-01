import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createGoalContributionSchema } from "@/lib/schemas";
import { addGoalContribution } from "@/lib/services/goal.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const input = createGoalContributionSchema.parse({ ...body, goalId: id });
    const created = await addGoalContribution(input);
    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
