import "server-only";
import { investmentsRepo } from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import {
  computeInvestmentGain,
  computeInvestmentReturnPct,
} from "@/lib/finance";
import { generateId } from "@/lib/id";
import type { Investment } from "@/types/domain";
import type { CreateInvestmentInput } from "@/lib/schemas";

/** Attach derived gain / return figures to an investment. */
function withDerived(investment: Investment): Investment {
  return {
    ...investment,
    gain: computeInvestmentGain(investment),
    returnPct: computeInvestmentReturnPct(investment),
  };
}

/** List investments with computed gain and return, newest purchase first. */
export async function listInvestments(): Promise<Investment[]> {
  const spreadsheetId = await getSpreadsheetId();
  const investments = await investmentsRepo.list(spreadsheetId);
  return investments
    .map(withDerived)
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
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
  return withDerived(await investmentsRepo.create(spreadsheetId, investment));
}

export async function updateInvestment(
  id: string,
  input: Partial<CreateInvestmentInput>,
): Promise<Investment> {
  const spreadsheetId = await getSpreadsheetId();
  return withDerived(await investmentsRepo.update(spreadsheetId, id, input));
}

export async function deleteInvestment(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await investmentsRepo.remove(spreadsheetId, id);
}
