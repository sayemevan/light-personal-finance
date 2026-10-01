import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { importCheckSchema } from "@/lib/schemas/import";
import { checkImport } from "@/lib/services/import.service";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = importCheckSchema.parse(await req.json());
    return ok(await checkImport(input));
  } catch (error) {
    return fail(error);
  }
}
