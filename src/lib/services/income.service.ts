import "server-only";
import {
  accountsRepo,
  categoriesRepo,
  incomeRepo,
} from "@/lib/repositories";
import { getSpreadsheetId, getWorkspaceForCurrentUser } from "@/lib/google/workspace";
import { getIncomeForYear } from "@/lib/services/history.service";
import { queryCollection } from "@/lib/services/query";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type { Income } from "@/types/domain";
import type { Paginated } from "@/types/api";
import type { CreateIncomeInput, IncomeListQuery } from "@/lib/schemas";

/**
 * Return a single page of income entries with server-side account/category
 * filtering, search and sort. Defaults to newest first.
 */
export async function listIncome(
  query: IncomeListQuery,
): Promise<Paginated<Income>> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const [income, accounts, categories] = await Promise.all([
    getIncomeForYear(query.year),
    accountsRepo.list(spreadsheetId),
    categoriesRepo.list(spreadsheetId),
  ]);

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? "";
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "";

  let rows = income;
  if (query.categoryId) {
    rows = rows.filter((i) => i.categoryId === query.categoryId);
  }
  if (query.accountId) {
    rows = rows.filter((i) => i.accountId === query.accountId);
  }
  if (query.tag) {
    const tag = query.tag.toLowerCase();
    rows = rows.filter((i) => i.tags?.includes(tag));
  }

  return queryCollection(
    rows,
    [
      { key: "date", get: (i) => i.date, searchable: true, sortable: true },
      {
        key: "category",
        get: (i) => categoryName(i.categoryId),
        searchable: true,
        sortable: true,
      },
      {
        key: "account",
        get: (i) => accountName(i.accountId),
        searchable: true,
        sortable: true,
      },
      {
        key: "notes",
        get: (i) =>
          `${i.notes ?? ""} ${(i.tags ?? []).map((t) => `#${t}`).join(" ")}`,
        searchable: true,
      },
      { key: "amount", get: (i) => i.amount, sortable: true },
    ],
    {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      sortBy: query.sortBy ?? "date",
      sortDir: query.sortDir ?? "desc",
    },
  );
}

export async function getIncome(id: string): Promise<Income> {
  const spreadsheetId = await getSpreadsheetId();
  const income = await incomeRepo.findById(spreadsheetId, id);
  if (!income) throw AppError.notFound("Income not found.");
  return income;
}

export async function createIncome(input: CreateIncomeInput): Promise<Income> {
  const spreadsheetId = await getSpreadsheetId();
  const now = new Date().toISOString();
  const income: Income = {
    id: generateId(),
    date: input.date,
    amount: input.amount,
    categoryId: input.categoryId,
    accountId: input.accountId,
    notes: input.notes,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
  };
  return incomeRepo.create(spreadsheetId, income);
}

export async function updateIncome(
  id: string,
  input: Partial<CreateIncomeInput>,
): Promise<Income> {
  const spreadsheetId = await getSpreadsheetId();
  return incomeRepo.update(spreadsheetId, id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteIncome(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await incomeRepo.remove(spreadsheetId, id);
}
