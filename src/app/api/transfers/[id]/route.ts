import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateTransferSchema } from "@/lib/schemas";
import {
  deleteTransfer,
  updateTransfer,
} from "@/lib/services/transfer.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const input = updateTransferSchema.parse(await req.json());
    return ok(await updateTransfer(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteTransfer(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
