import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { updateCategorySchema } from "@/lib/schemas";
import {
  deleteCategory,
  updateCategory,
} from "@/lib/services/category.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const input = updateCategorySchema.parse(await req.json());
    return ok(await updateCategory(id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteCategory(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
