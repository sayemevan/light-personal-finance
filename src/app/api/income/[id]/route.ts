import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateIncomeSchema } from "@/lib/schemas";
import {
  deleteIncome,
  getIncome,
  updateIncome,
} from "@/lib/services/income.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    return ok(await getIncome(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const input = updateIncomeSchema.parse(await req.json());
    return ok(await updateIncome(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteIncome(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
