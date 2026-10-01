import "server-only";
import {
  investmentsRepo,
  investmentTransactionsRepo,
} from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { loadLedger } from "@/lib/services/ledger.service";
import {
  computeInvestmentGain,
  computeInvestmentReturnPct,
} from "@/lib/finance";
import { generateId } from "@/lib/id";
import { formatCurrency } from "@/lib/format";
import { getSettings } from "@/lib/services/settings.service";
import { AppError } from "@/lib/errors";
import type { Investment, InvestmentTransaction } from "@/types/domain";
import type {
  CreateInvestmentInput,
  CreateInvestmentTransactionInput,
} from "@/lib/schemas";

/** Attach derived gain / return figures (including payouts received). */
function withDerived(
  investment: Investment,
  transactions: InvestmentTransaction[],
): Investment {
  return {
    ...investment,
    gain: computeInvestmentGain(investment, transactions),
    returnPct: computeInvestmentReturnPct(investment, transactions),
  };
}

/** List investments with computed gain and return, newest purchase first. */
export async function listInvestments(): Promise<Investment[]> {
  const { investments, investmentTransactions } = await loadLedger();
  return investments
    .map((investment) => withDerived(investment, investmentTransactions))
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
}

async function transactionsFor(
  spreadsheetId: string,
  investmentId: string,
): Promise<InvestmentTransaction[]> {
  return (await investmentTransactionsRepo.list(spreadsheetId)).filter(
    (t) => t.investmentId === investmentId,
  );
}

export async function getInvestment(
  id: string,
): Promise<Investment & { transactions: InvestmentTransaction[] }> {
  const spreadsheetId = await getSpreadsheetId();
  const investment = await investmentsRepo.findById(spreadsheetId, id);
  if (!investment) throw AppError.notFound("Investment not found.");

  const transactions = (await investmentTransactionsRepo.list(spreadsheetId))
    .filter((t) => t.investmentId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return { ...withDerived(investment, transactions), transactions };
}

export async function createInvestment(
  input: CreateInvestmentInput,
): Promise<Investment> {
  const spreadsheetId = await getSpreadsheetId();
  const investment: Investment = {
    id: generateId(),
    name: input.name,
    type: input.type,
    purchaseDate: input.purchaseDate,
    amountInvested: input.amountInvested,
    currentValue: input.currentValue,
    accountId: input.accountId || undefined,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  return withDerived(await investmentsRepo.create(spreadsheetId, investment), []);
}

export async function updateInvestment(
  id: string,
  input: Partial<CreateInvestmentInput>,
): Promise<Investment> {
  const spreadsheetId = await getSpreadsheetId();
  const updated = await investmentsRepo.update(spreadsheetId, id, {
    ...input,
    // An emptied "Paid from" means an external source, not account "".
    ...(input.accountId !== undefined
      ? { accountId: input.accountId || undefined }
      : {}),
  });
  return withDerived(updated, await transactionsFor(spreadsheetId, id));
}

export async function deleteInvestment(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();

  // Remove associated transactions first so no orphans linger.
  const transactions = (
    await investmentTransactionsRepo.list(spreadsheetId)
  ).filter((t) => t.investmentId === id);
  for (const transaction of transactions) {
    await investmentTransactionsRepo.remove(spreadsheetId, transaction.id);
  }

  await investmentsRepo.remove(spreadsheetId, id);
}

/**
 * Record an income or loss against an investment.
 *   • income → money received into the chosen account (account balance rises);
 *     the investment's current value is left unchanged.
 *   • loss → the investment's current value is reduced by the amount; no
 *     account is touched.
 */
export async function addInvestmentTransaction(
  input: CreateInvestmentTransactionInput,
): Promise<InvestmentTransaction> {
  const spreadsheetId = await getSpreadsheetId();

  const investment = await investmentsRepo.findById(
    spreadsheetId,
    input.investmentId,
  );
  if (!investment) throw AppError.notFound("Investment not found.");

  // A loss can't take the value below zero; deleting the entry later restores
  // exactly this amount, so it must be fully applied.
  if (input.direction === "loss" && input.amount > investment.currentValue) {
    const { currency } = await getSettings();
    throw AppError.validation(
      `A loss can't be more than the current value (${formatCurrency(investment.currentValue, currency)}). Edit the investment's current value instead.`,
      { amount: ["More than the current value"] },
    );
  }

  const transaction: InvestmentTransaction = {
    id: generateId(),
    investmentId: input.investmentId,
    date: input.date,
    amount: input.amount,
    direction: input.direction,
    accountId: input.direction === "income" ? input.accountId : undefined,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };

  const created = await investmentTransactionsRepo.create(
    spreadsheetId,
    transaction,
  );

  if (input.direction === "loss") {
    const nextValue = Number(
      (investment.currentValue - input.amount).toFixed(2),
    );
    await investmentsRepo.update(spreadsheetId, investment.id, {
      currentValue: nextValue,
    });
  }

  return created;
}

export async function deleteInvestmentTransaction(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();

  const transaction = await investmentTransactionsRepo.findById(
    spreadsheetId,
    id,
  );
  if (!transaction) throw AppError.notFound("Transaction not found.");

  // Reversing a loss restores the value it removed from the investment.
  if (transaction.direction === "loss") {
    const investment = await investmentsRepo.findById(
      spreadsheetId,
      transaction.investmentId,
    );
    if (investment) {
      const restored = Number(
        (investment.currentValue + transaction.amount).toFixed(2),
      );
      await investmentsRepo.update(spreadsheetId, investment.id, {
        currentValue: restored,
      });
    }
  }

  await investmentTransactionsRepo.remove(spreadsheetId, id);
}
