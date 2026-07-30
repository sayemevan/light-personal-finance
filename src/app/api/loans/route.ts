import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createLoanSchema, loanTypeSchema } from "@/lib/schemas";
import { createLoan, listLoans } from "@/lib/services/loan.service";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const typeParam = req.nextUrl.searchParams.get("type");
    const type = typeParam ? loanTypeSchema.parse(typeParam) : undefined;
    return ok(await listLoans(type));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createLoanSchema.parse(await req.json());
    return ok(await createLoan(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
