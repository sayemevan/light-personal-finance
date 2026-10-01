import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/session";
import {
  getSettings,
  isSupportedCurrency,
  updateSettings,
} from "@/lib/services/settings.service";

const updateSettingsSchema = z.object({
  currency: z
    .string()
    .trim()
    .transform((code) => code.toUpperCase())
    .refine(isSupportedCurrency, "Choose a valid currency code, e.g. BDT.")
    .optional(),
});

export async function GET() {
  try {
    await requireSession();
    return ok(await getSettings());
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSession();
    const input = updateSettingsSchema.parse(await req.json());
    return ok(await updateSettings(input));
  } catch (error) {
    return fail(error);
  }
}
