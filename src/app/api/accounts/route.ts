import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createAccountSchema } from "@/lib/schemas";
import { createAccount, listAccounts } from "@/lib/services/account.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await listAccounts());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createAccountSchema.parse(await req.json());
    return ok(await createAccount(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
