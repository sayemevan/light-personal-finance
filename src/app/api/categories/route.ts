import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import { categoryKindSchema, createCategorySchema } from "@/lib/schemas";
import {
  createCategory,
  listCategories,
} from "@/lib/services/category.service";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const kindParam = req.nextUrl.searchParams.get("kind");
    const kind = kindParam
      ? categoryKindSchema.parse(kindParam)
      : undefined;
    return ok(await listCategories(kind));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createCategorySchema.parse(await req.json());
    return ok(await createCategory(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
