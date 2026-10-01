import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { importTransactionsSchema } from "@/lib/schemas/import";
import { importTransactions } from "@/lib/services/import.service";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = importTransactionsSchema.parse(await req.json());
    return ok(await importTransactions(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
