import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateBudgetSchema } from "@/lib/schemas";
import { deleteBudget, updateBudget } from "@/lib/services/budget.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const input = updateBudgetSchema.parse(await req.json());
    return ok(await updateBudget(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteBudget(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
