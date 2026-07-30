import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { uploadReceipt } from "@/lib/services/receipt.service";

/** Upload a receipt (multipart/form-data with a `file` field). */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw AppError.validation("A file is required.", {
        file: ["Expected a file upload."],
      });
    }
    return ok(await uploadReceipt(file), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
