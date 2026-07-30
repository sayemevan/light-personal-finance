import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createExpenseSchema } from "@/lib/schemas";
import { createExpense, listExpenses } from "@/lib/services/expense.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await listExpenses());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createExpenseSchema.parse(await req.json());
    const created = await createExpense(input);
    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
