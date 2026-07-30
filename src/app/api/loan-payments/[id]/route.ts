import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { deleteLoanPayment } from "@/lib/services/loan.service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteLoanPayment(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
