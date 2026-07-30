import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateLoanSchema } from "@/lib/schemas";
import { deleteLoan, getLoan, updateLoan } from "@/lib/services/loan.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    return ok(await getLoan(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const input = updateLoanSchema.parse(await req.json());
    return ok(await updateLoan(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteLoan(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
