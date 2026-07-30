import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createIncomeSchema } from "@/lib/schemas";
import { createIncome, listIncome } from "@/lib/services/income.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await listIncome());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createIncomeSchema.parse(await req.json());
    return ok(await createIncome(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
