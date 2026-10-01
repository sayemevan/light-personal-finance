import "server-only";
import { accountsRepo } from "@/lib/repositories";
import { loadLedger } from "@/lib/services/ledger.service";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { getSettings } from "@/lib/services/settings.service";
import { computeAccountBalance } from "@/lib/finance";
import { generateId } from "@/lib/id";
import type { Account } from "@/types/domain";
import type { CreateAccountInput } from "@/lib/schemas";

/** List accounts with their computed current balance. */
export async function listAccounts(): Promise<Account[]> {
  const ledger = await loadLedger();
  return ledger.accounts.map((account) => ({
    ...account,
    currentBalance: computeAccountBalance(account, ledger),
  }));
}

export async function createAccount(
  input: CreateAccountInput,
): Promise<Account> {
  const spreadsheetId = await getSpreadsheetId();
  const account: Account = {
    id: generateId(),
    name: input.name,
    type: input.type,
    openingBalance: input.openingBalance,
    currency: input.currency ?? (await getSettings()).currency,
    isArchived: false,
    createdAt: new Date().toISOString(),
  };
  return accountsRepo.create(spreadsheetId, account);
}

export async function updateAccount(
  id: string,
  input: Partial<CreateAccountInput> & { isArchived?: boolean },
): Promise<Account> {
  const spreadsheetId = await getSpreadsheetId();
  return accountsRepo.update(spreadsheetId, id, input);
}

export async function deleteAccount(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await accountsRepo.remove(spreadsheetId, id);
}
