import "server-only";
import {
  accountsRepo,
  categoriesRepo,
  expensesRepo,
  loansRepo,
} from "@/lib/repositories";
import { loadLedger } from "@/lib/services/ledger.service";
import { getWorkspaceForCurrentUser } from "@/lib/google/workspace";
import { deleteFile } from "@/lib/google/drive";
import { getExpensesForYear } from "@/lib/services/history.service";
import { queryCollection } from "@/lib/services/query";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type { Expense, Loan, PaymentMethod } from "@/types/domain";
import type { Paginated } from "@/types/api";
import type {
  CreateExpenseInput,
  CreateExpenseWithSplitInput,
  ExpenseListQuery,
} from "@/lib/schemas";

/**
 * Return a single page of expenses, applying account/category filters plus
 * server-side search and sort so the client only receives what it renders.
 * Defaults to newest first when no explicit sort is requested.
 */
export async function listExpenses(
  query: ExpenseListQuery,
): Promise<Paginated<Expense>> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const [expenses, accounts, categories] = await Promise.all([
    getExpensesForYear(query.year),
    accountsRepo.list(spreadsheetId),
    categoriesRepo.list(spreadsheetId),
  ]);

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? "";
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "";

  let rows = expenses;
  if (query.categoryId) {
    rows = rows.filter((e) => e.categoryId === query.categoryId);
  }
  if (query.accountId) {
    rows = rows.filter((e) => e.accountId === query.accountId);
  }
  if (query.tag) {
    const tag = query.tag.toLowerCase();
    rows = rows.filter((e) => e.tags?.includes(tag));
  }

  return queryCollection(
    rows,
    [
      { key: "date", get: (e) => e.date, searchable: true, sortable: true },
      {
        key: "category",
        get: (e) => categoryName(e.categoryId),
        searchable: true,
        sortable: true,
      },
      {
        key: "account",
        get: (e) => accountName(e.accountId),
        searchable: true,
        sortable: true,
      },
      {
        key: "merchant",
        get: (e) =>
          `${e.merchant ?? ""} ${e.notes ?? ""} ${(e.tags ?? []).map((t) => `#${t}`).join(" ")}`,
        searchable: true,
      },
      { key: "amount", get: (e) => e.amount, sortable: true },
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

export async function getExpense(id: string): Promise<Expense> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const expense = await expensesRepo.findById(spreadsheetId, id);
  if (!expense) throw AppError.notFound("Expense not found.");
  return expense;
}

export async function createExpense(
  input: CreateExpenseInput,
  options: { id?: string } = {},
): Promise<Expense> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const now = new Date().toISOString();
  const expense: Expense = {
    id: options.id ?? generateId(),
    date: input.date,
    amount: input.amount,
    categoryId: input.categoryId,
    accountId: input.accountId,
    paymentMethod: input.paymentMethod,
    merchant: input.merchant,
    notes: input.notes,
    receiptFileId: input.receiptFileId,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
  };
  return expensesRepo.create(spreadsheetId, expense);
}

export async function updateExpense(
  id: string,
  input: Partial<CreateExpenseInput>,
): Promise<Expense> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  return expensesRepo.update(spreadsheetId, id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const expense = await expensesRepo.findById(spreadsheetId, id);
  if (!expense) throw AppError.notFound("Expense not found.");

  // Best-effort receipt cleanup; never block deletion on Drive errors.
  if (expense.receiptFileId) {
    try {
      await deleteFile(expense.receiptFileId);
    } catch (error) {
      console.error("[expense] failed to delete receipt", error);
    }
  }

  await expensesRepo.remove(spreadsheetId, id);
}

/**
 * Record a bill you paid for several people. Only your share is an expense;
 * each other person's share becomes money lent to them from the same account,
 * so the account still drops by the full bill and repayments flow back in.
 */
export async function createExpenseWithSplit(
  input: CreateExpenseWithSplitInput & CreateExpenseInput,
): Promise<{ expense: Expense; loans: Loan[] }> {
  const splits = input.splits ?? [];
  const othersTotal = splits.reduce((sum, split) => sum + split.amount, 0);
  const share = Number((input.amount - othersTotal).toFixed(2));
  if (splits.length > 0 && share <= 0) {
    throw AppError.validation(
      "Other people's shares must add up to less than the total.",
      { splits: ["Shares exceed the total"] },
    );
  }

  const { splits: _splits, ...expenseInput } = input;
  const expense = await createExpense({
    ...expenseInput,
    amount: share,
    notes: splits.length
      ? [
          input.notes,
          `Split bill: total ${input.amount}, shared with ${splits
            .map((s) => s.person)
            .join(", ")}`,
        ]
          .filter(Boolean)
          .join(" · ")
      : input.notes,
  });

  if (splits.length === 0) return { expense, loans: [] };

  const { spreadsheetId } = await getWorkspaceForCurrentUser();
  const now = new Date().toISOString();
  const label = input.merchant ? `${input.merchant} ` : "";
  const loans: Loan[] = splits.map((split) => ({
    id: generateId(),
    type: "lent",
    person: split.person,
    accountId: input.accountId,
    principal: split.amount,
    borrowDate: input.date,
    status: "active",
    notes: `Share of ${label}bill on ${input.date}`,
    createdAt: now,
  }));
  await loansRepo.appendMany(spreadsheetId, loans);
  return { expense, loans };
}

export interface EntrySuggestions {
  /** Most-used merchants with the category/account they're usually logged as. */
  merchants: {
    name: string;
    categoryId: string;
    accountId: string;
    paymentMethod: PaymentMethod;
    count: number;
  }[];
  /** Every tag in use, most used first. */
  tags: string[];
}

/** Autocomplete data for fast expense entry, built from live history. */
export async function getEntrySuggestions(): Promise<EntrySuggestions> {
  const { expenses, income } = await loadLedger();

  const byMerchant = new Map<
    string,
    {
      name: string;
      count: number;
      last: string;
      votes: Map<string, number>;
      latest: Expense;
    }
  >();
  for (const expense of expenses) {
    const name = expense.merchant?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = byMerchant.get(key) ?? {
      name,
      count: 0,
      last: "",
      votes: new Map<string, number>(),
      latest: expense,
    };
    entry.count += 1;
    entry.votes.set(
      expense.categoryId,
      (entry.votes.get(expense.categoryId) ?? 0) + 1,
    );
    if (expense.date >= entry.last) {
      entry.last = expense.date;
      entry.latest = expense;
      entry.name = name;
    }
    byMerchant.set(key, entry);
  }

  const merchants = [...byMerchant.values()]
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, 200)
    .map((entry) => ({
      name: entry.name,
      categoryId: [...entry.votes.entries()].sort((a, b) => b[1] - a[1])[0]![0],
      accountId: entry.latest.accountId,
      paymentMethod: entry.latest.paymentMethod,
      count: entry.count,
    }));

  const tagCounts = new Map<string, number>();
  for (const row of [...expenses, ...income]) {
    for (const tag of row.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  return { merchants, tags };
}
