import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateAccountSchema } from "@/lib/schemas";
import {
  deleteAccount,
  updateAccount,
} from "@/lib/services/account.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const input = updateAccountSchema.parse(await req.json());
    return ok(await updateAccount(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteAccount(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
