import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateAssetSchema } from "@/lib/schemas";
import { deleteAsset, updateAsset } from "@/lib/services/asset.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const input = updateAssetSchema.parse(await req.json());
    return ok(await updateAsset(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteAsset(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
