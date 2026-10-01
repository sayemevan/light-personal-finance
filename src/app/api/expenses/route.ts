import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createOptions } from "@/lib/idempotency";
import {
  createExpenseWithSplitSchema,
  expenseListQuerySchema,
} from "@/lib/schemas";
import {
  createExpenseWithSplit,
  listExpenses,
} from "@/lib/services/expense.service";
import { getBudgetAlert } from "@/lib/services/budget.service";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const query = expenseListQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return ok(await listExpenses(query));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createExpenseWithSplitSchema.parse(await req.json());
    const { expense, loans } = await createExpenseWithSplit(
      input,
      createOptions(req),
    );
    // A budget warning is a nice-to-have; never fail the save over it.
    const budgetAlert = await getBudgetAlert(
      expense.categoryId,
      expense.date,
    ).catch(() => null);
    return ok(
      { ...expense, splitLoans: loans.length, budgetAlert },
      { status: 201 },
    );
  } catch (error) {
    return fail(error);
  }
}
