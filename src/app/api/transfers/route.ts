import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createTransferSchema, paginationQuerySchema } from "@/lib/schemas";
import { createTransfer, listTransfers } from "@/lib/services/transfer.service";

const transferListQuerySchema = paginationQuerySchema
  .omit({ year: true })
  .extend({ accountId: z.string().optional() });

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const query = transferListQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return ok(await listTransfers(query));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createTransferSchema.parse(await req.json());
    return ok(await createTransfer(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
