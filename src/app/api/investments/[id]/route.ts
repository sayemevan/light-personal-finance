import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateInvestmentSchema } from "@/lib/schemas";
import {
  deleteInvestment,
  getInvestment,
  updateInvestment,
} from "@/lib/services/investment.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    return ok(await getInvestment(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const input = updateInvestmentSchema.parse(await req.json());
    return ok(await updateInvestment(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteInvestment(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
