import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { yearSchema } from "@/lib/schemas";
import {
  EXPORT_KINDS,
  saveExportToDrive,
} from "@/lib/services/export.service";

const driveExportSchema = z.object({
  kind: z.enum(EXPORT_KINDS),
  year: yearSchema,
});

/** Save a CSV export into the user's Drive "Reports" folder. */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const { kind, year } = driveExportSchema.parse(await req.json());
    return ok(await saveExportToDrive(kind, year));
  } catch (error) {
    return fail(error);
  }
}
