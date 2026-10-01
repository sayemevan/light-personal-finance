import "server-only";
import { categoriesRepo } from "@/lib/repositories";
import { loadLedger } from "@/lib/services/ledger.service";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { generateId } from "@/lib/id";
import type { Category, CategoryKind } from "@/types/domain";
import type { CreateCategoryInput } from "@/lib/schemas";

export async function listCategories(
  kind?: CategoryKind,
): Promise<Category[]> {
  const { categories } = await loadLedger();
  return kind ? categories.filter((c) => c.kind === kind) : categories;
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<Category> {
  const spreadsheetId = await getSpreadsheetId();
  const category: Category = {
    id: generateId(),
    name: input.name,
    kind: input.kind,
    icon: input.icon,
    isDefault: false,
    isArchived: false,
  };
  return categoriesRepo.create(spreadsheetId, category);
}

export async function updateCategory(
  id: string,
  input: Partial<CreateCategoryInput> & { isArchived?: boolean },
): Promise<Category> {
  const spreadsheetId = await getSpreadsheetId();
  return categoriesRepo.update(spreadsheetId, id, input);
}

export async function deleteCategory(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await categoriesRepo.remove(spreadsheetId, id);
}
