import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createInvestmentSchema } from "@/lib/schemas";
import {
  createInvestment,
  listInvestments,
} from "@/lib/services/investment.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await listInvestments());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createInvestmentSchema.parse(await req.json());
    return ok(await createInvestment(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
