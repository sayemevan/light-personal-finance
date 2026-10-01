import "server-only";
import {
  accountsRepo,
  assetsRepo,
  expensesRepo,
  incomeRepo,
  investmentsRepo,
  investmentTransactionsRepo,
  loansRepo,
  loanPaymentsRepo,
} from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { getSettings } from "@/lib/services/settings.service";
import { computeAccountBalance } from "@/lib/finance";
import { generateId } from "@/lib/id";
import type { Account } from "@/types/domain";
import type { CreateAccountInput } from "@/lib/schemas";

/** List accounts with their computed current balance. */
export async function listAccounts(): Promise<Account[]> {
  const spreadsheetId = await getSpreadsheetId();
  const [
    accounts,
    expenses,
    income,
    investments,
    assets,
    loans,
    payments,
    investmentTransactions,
  ] = await Promise.all([
    accountsRepo.list(spreadsheetId),
    expensesRepo.list(spreadsheetId),
    incomeRepo.list(spreadsheetId),
    investmentsRepo.list(spreadsheetId),
    assetsRepo.list(spreadsheetId),
    loansRepo.list(spreadsheetId),
    loanPaymentsRepo.list(spreadsheetId),
    investmentTransactionsRepo.list(spreadsheetId),
  ]);
  return accounts.map((account) => ({
    ...account,
    currentBalance: computeAccountBalance(
      account,
      expenses,
      income,
      investments,
      assets,
      loans,
      payments,
      investmentTransactions,
    ),
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
