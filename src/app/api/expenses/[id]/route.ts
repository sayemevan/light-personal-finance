import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateExpenseSchema } from "@/lib/schemas";
import {
  deleteExpense,
  getExpense,
  updateExpense,
} from "@/lib/services/expense.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    return ok(await getExpense(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const input = updateExpenseSchema.parse(await req.json());
    return ok(await updateExpense(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteExpense(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
