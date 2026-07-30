import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import {
  getReceiptMeta,
  removeReceipt,
} from "@/lib/services/receipt.service";

type Params = { params: Promise<{ fileId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { fileId } = await params;
    return ok(await getReceiptMeta(fileId));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { fileId } = await params;
    await removeReceipt(fileId);
    return ok({ fileId });
  } catch (error) {
    return fail(error);
  }
}
