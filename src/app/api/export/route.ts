import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { yearSchema } from "@/lib/schemas";
import { EXPORT_KINDS, buildExport } from "@/lib/services/export.service";

const exportQuerySchema = z.object({
  kind: z.enum(EXPORT_KINDS).default("all"),
  year: yearSchema,
});

/** Download expenses / income / transfers as a UTF-8 CSV file. */
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { kind, year } = exportQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    const { fileName, csv } = await buildExport(kind, year);
    const asciiName = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
