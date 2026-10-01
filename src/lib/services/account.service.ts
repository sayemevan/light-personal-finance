import "server-only";
import { accountsRepo } from "@/lib/repositories";
import { loadLedger } from "@/lib/services/ledger.service";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { getSettings } from "@/lib/services/settings.service";
import { computeAccountBalance } from "@/lib/finance";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type { Ledger } from "@/lib/services/ledger.service";
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

/** Records that still point at an account, by kind (only kinds in use). */
function accountReferences(id: string, ledger: Ledger): string[] {
  const counts: [string, number][] = [
    ["expenses", ledger.expenses.filter((e) => e.accountId === id).length],
    ["income", ledger.income.filter((i) => i.accountId === id).length],
    [
      "transfers",
      ledger.transfers.filter(
        (t) => t.fromAccountId === id || t.toAccountId === id,
      ).length,
    ],
    ["loans", ledger.loans.filter((l) => l.accountId === id).length],
    [
      "loan payments",
      ledger.loanPayments.filter((p) => p.accountId === id).length,
    ],
    [
      "investments",
      ledger.investments.filter((v) => v.accountId === id).length,
    ],
    [
      "investment transactions",
      ledger.investmentTransactions.filter((t) => t.accountId === id).length,
    ],
    [
      "assets",
      ledger.assets.filter(
        (a) => a.accountId === id || a.saleAccountId === id,
      ).length,
    ],
    ["goals", ledger.goals.filter((g) => g.accountId === id).length],
    [
      "recurring rules",
      ledger.recurring.filter(
        (r) => r.accountId === id || r.toAccountId === id,
      ).length,
    ],
  ];
  return counts
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${kind}`);
}

/**
 * Delete an account that nothing references. Records left pointing at a
 * deleted account would silently drop out of every balance.
 */
export async function deleteAccount(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  const references = accountReferences(id, await loadLedger(spreadsheetId));
  if (references.length > 0) {
    throw new AppError(
      "CONFLICT",
      `This account is still used by ${references.join(", ")}. Move or delete those first.`,
    );
  }
  await accountsRepo.remove(spreadsheetId, id);
}
