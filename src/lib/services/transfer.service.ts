import "server-only";
import { transfersRepo } from "@/lib/repositories";
import { loadLedger } from "@/lib/services/ledger.service";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { queryCollection } from "@/lib/services/query";
import { generateId } from "@/lib/id";
import type { CreateOptions } from "@/lib/idempotency";
import { AppError } from "@/lib/errors";
import type { Transfer } from "@/types/domain";
import type { Paginated } from "@/types/api";
import type { CreateTransferInput } from "@/lib/schemas";

export interface TransferListQuery {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  accountId?: string;
}

/** A page of transfers, newest first by default. */
export async function listTransfers(
  query: TransferListQuery,
): Promise<Paginated<Transfer>> {
  const { transfers, accounts } = await loadLedger();
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? "";

  const rows = query.accountId
    ? transfers.filter(
        (t) =>
          t.fromAccountId === query.accountId ||
          t.toAccountId === query.accountId,
      )
    : transfers;

  return queryCollection(
    rows,
    [
      { key: "date", get: (t) => t.date, searchable: true, sortable: true },
      {
        key: "from",
        get: (t) => accountName(t.fromAccountId),
        searchable: true,
        sortable: true,
      },
      {
        key: "to",
        get: (t) => accountName(t.toAccountId),
        searchable: true,
        sortable: true,
      },
      { key: "notes", get: (t) => t.notes, searchable: true },
      { key: "amount", get: (t) => t.amount, sortable: true },
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

async function assertAccounts(
  spreadsheetId: string,
  ids: string[],
): Promise<void> {
  const { accounts } = await loadLedger(spreadsheetId);
  for (const id of ids) {
    if (!accounts.some((a) => a.id === id)) {
      throw AppError.validation("Account not found.");
    }
  }
}

export async function createTransfer(
  input: CreateTransferInput,
  options: CreateOptions = {},
): Promise<Transfer> {
  const spreadsheetId = await getSpreadsheetId();
  if (options.id && options.ifAbsent) {
    const existing = await transfersRepo.findById(spreadsheetId, options.id);
    if (existing) return existing;
  }
  await assertAccounts(spreadsheetId, [input.fromAccountId, input.toAccountId]);
  const transfer: Transfer = {
    id: options.id ?? generateId(),
    date: input.date,
    amount: input.amount,
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  return transfersRepo.create(spreadsheetId, transfer);
}

export async function updateTransfer(
  id: string,
  input: Partial<CreateTransferInput>,
): Promise<Transfer> {
  const spreadsheetId = await getSpreadsheetId();
  const current = await transfersRepo.findById(spreadsheetId, id);
  if (!current) throw AppError.notFound("Transfer not found.");
  const from = input.fromAccountId ?? current.fromAccountId;
  const to = input.toAccountId ?? current.toAccountId;
  if (from === to) {
    throw AppError.validation("Choose two different accounts.");
  }
  // Same check as create, for whichever side changed.
  const changed = [input.fromAccountId, input.toAccountId].filter(
    (accountId): accountId is string => Boolean(accountId),
  );
  if (changed.length > 0) await assertAccounts(spreadsheetId, changed);
  return transfersRepo.update(spreadsheetId, id, input);
}

export async function deleteTransfer(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await transfersRepo.remove(spreadsheetId, id);
}
