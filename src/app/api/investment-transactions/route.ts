import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createInvestmentTransactionSchema } from "@/lib/schemas";
import { addInvestmentTransaction } from "@/lib/services/investment.service";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createInvestmentTransactionSchema.parse(await req.json());
    return ok(await addInvestmentTransaction(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
