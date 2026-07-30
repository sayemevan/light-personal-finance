import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createLoanPaymentSchema } from "@/lib/schemas";
import { addLoanPayment } from "@/lib/services/loan.service";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createLoanPaymentSchema.parse(await req.json());
    return ok(await addLoanPayment(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
