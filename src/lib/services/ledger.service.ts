import "server-only";
import { getSheetsClient } from "@/lib/google/client";
import { spreadsheetGeneration } from "@/lib/google/repository";
import { getSpreadsheetId } from "@/lib/google/workspace";
import {
  accountsRepo,
  assetsRepo,
  budgetsRepo,
  categoriesRepo,
  expensesRepo,
  goalContributionsRepo,
  goalsRepo,
  incomeRepo,
  investmentsRepo,
  investmentTransactionsRepo,
  loanPaymentsRepo,
  loansRepo,
  recurringRepo,
  transfersRepo,
} from "@/lib/repositories";
import type {
  Account,
  Asset,
  Budget,
  Category,
  Expense,
  Goal,
  GoalContribution,
  Income,
  Investment,
  InvestmentTransaction,
  Loan,
  LoanPayment,
  RecurringRule,
  Transfer,
} from "@/types/domain";

/** Every live tab of the Finance spreadsheet, decoded. */
export interface Ledger {
  accounts: Account[];
  categories: Category[];
  expenses: Expense[];
  income: Income[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  investments: Investment[];
  investmentTransactions: InvestmentTransaction[];
  assets: Asset[];
  transfers: Transfer[];
  budgets: Budget[];
  goals: Goal[];
  goalContributions: GoalContribution[];
  recurring: RecurringRule[];
}

const REPOS = {
  accounts: accountsRepo,
  categories: categoriesRepo,
  expenses: expensesRepo,
  income: incomeRepo,
  loans: loansRepo,
  loanPayments: loanPaymentsRepo,
  investments: investmentsRepo,
  investmentTransactions: investmentTransactionsRepo,
  assets: assetsRepo,
  transfers: transfersRepo,
  budgets: budgetsRepo,
  goals: goalsRepo,
  goalContributions: goalContributionsRepo,
  recurring: recurringRepo,
} as const;

type LedgerKey = keyof typeof REPOS;
const KEYS = Object.keys(REPOS) as LedgerKey[];

/**
 * Reads are shared briefly so the burst of queries a page fires after a
 * mutation (dashboard, accounts, reports…) costs one Sheets call, not dozens.
 * Any write through a repository bumps the spreadsheet's generation, which
 * invalidates the shared read immediately within this instance.
 */
const SHARE_MS = 2000;
const shared = new Map<
  string,
  { generation: number; startedAt: number; promise: Promise<Ledger> }
>();

async function fetchLedger(spreadsheetId: string): Promise<Ledger> {
  const sheets = await getSheetsClient();
  try {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: KEYS.map((key) => REPOS[key].dataRange),
    });
    const ranges = res.data.valueRanges ?? [];
    const ledger = {} as Record<LedgerKey, unknown[]>;
    KEYS.forEach((key, index) => {
      const rows = (ranges[index]?.values as string[][] | undefined) ?? [];
      ledger[key] = REPOS[key].parse(rows);
    });
    return ledger as unknown as Ledger;
  } catch (error) {
    // A tab added in a newer schema may not exist yet on this spreadsheet
    // (migration runs on workspace resolve). Only that case falls back to
    // per-tab reads with the missing tab treated as empty. Anything else
    // (rate limit, expired token, outage) must surface: reading it as empty
    // tabs would show wrong balances and totals with no error.
    if (!isMissingTab(error)) throw error;
    console.warn("[ledger] a tab is missing, reading per tab", error);
    const entries = await Promise.all(
      KEYS.map(async (key) => {
        try {
          return [key, await REPOS[key].list(spreadsheetId)] as const;
        } catch (tabError) {
          if (isMissingTab(tabError)) return [key, []] as const;
          throw tabError;
        }
      }),
    );
    return Object.fromEntries(entries) as unknown as Ledger;
  }
}

/** Sheets' error for a range on a tab that doesn't exist. */
function isMissingTab(error: unknown): boolean {
  return error instanceof Error && /unable to parse range/i.test(error.message);
}

/** Load the whole ledger for the signed-in user in a single batched read. */
export async function loadLedger(spreadsheetId?: string): Promise<Ledger> {
  const id = spreadsheetId ?? (await getSpreadsheetId());
  const generation = spreadsheetGeneration(id);
  const cached = shared.get(id);
  if (
    cached &&
    cached.generation === generation &&
    Date.now() - cached.startedAt < SHARE_MS
  ) {
    return cached.promise;
  }
  const promise = fetchLedger(id);
  shared.set(id, { generation, startedAt: Date.now(), promise });
  promise.catch(() => shared.delete(id));
  return promise;
}
