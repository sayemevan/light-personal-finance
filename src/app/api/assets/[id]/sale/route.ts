import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { sellAssetSchema } from "@/lib/schemas";
import { sellAsset, undoAssetSale } from "@/lib/services/asset.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const input = sellAssetSchema.parse(await req.json());
    return ok(await sellAsset(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    return ok(await undoAssetSale(id));
  } catch (error) {
    return fail(error);
  }
}
