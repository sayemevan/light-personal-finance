import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { createAssetSchema } from "@/lib/schemas";
import { createAsset, listAssets } from "@/lib/services/asset.service";

export async function GET() {
  try {
    await requireSession();
    return ok(await listAssets());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createAssetSchema.parse(await req.json());
    return ok(await createAsset(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
