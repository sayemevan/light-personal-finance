import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { archiveKindSchema } from "@/lib/schemas";
import { archiveTransactions } from "@/lib/services/archive.service";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const { kind } = archiveKindSchema.parse(await req.json());
    return ok(await archiveTransactions(kind));
  } catch (error) {
    return fail(error);
  }
}
