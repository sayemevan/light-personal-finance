import "server-only";
import { loansRepo, loanPaymentsRepo } from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { computeLoanRemaining } from "@/lib/finance";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type { Loan, LoanPayment, LoanType } from "@/types/domain";
import type { CreateLoanInput, CreateLoanPaymentInput } from "@/lib/schemas";

/** List loans with computed remaining balances, optionally filtered by type. */
export async function listLoans(type?: LoanType): Promise<Loan[]> {
  const spreadsheetId = await getSpreadsheetId();
  const [loans, payments] = await Promise.all([
    loansRepo.list(spreadsheetId),
    loanPaymentsRepo.list(spreadsheetId),
  ]);
  return loans
    .filter((loan) => (type ? loan.type === type : true))
    .map((loan) => ({
      ...loan,
      remainingBalance: computeLoanRemaining(loan, payments),
    }))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

export async function getLoan(
  id: string,
): Promise<Loan & { payments: LoanPayment[] }> {
  const spreadsheetId = await getSpreadsheetId();
  const loan = await loansRepo.findById(spreadsheetId, id);
  if (!loan) throw AppError.notFound("Loan not found.");

  const payments = (await loanPaymentsRepo.list(spreadsheetId))
    .filter((p) => p.loanId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    ...loan,
    payments,
    remainingBalance: computeLoanRemaining(loan, payments),
  };
}

export async function createLoan(input: CreateLoanInput): Promise<Loan> {
  const spreadsheetId = await getSpreadsheetId();
  const loan: Loan = {
    id: generateId(),
    type: input.type,
    person: input.person,
    principal: input.principal,
    interestRate: input.interestRate,
    borrowDate: input.borrowDate,
    dueDate: input.dueDate,
    status: input.status,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  return loansRepo.create(spreadsheetId, loan);
}

export async function updateLoan(
  id: string,
  input: Partial<CreateLoanInput>,
): Promise<Loan> {
  const spreadsheetId = await getSpreadsheetId();
  return loansRepo.update(spreadsheetId, id, input);
}

export async function deleteLoan(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();

  // Remove associated payments first (iterating newest→oldest by row is safe
  // because each removal re-reads the sheet).
  const payments = (await loanPaymentsRepo.list(spreadsheetId)).filter(
    (p) => p.loanId === id,
  );
  for (const payment of payments) {
    await loanPaymentsRepo.remove(spreadsheetId, payment.id);
  }

  await loansRepo.remove(spreadsheetId, id);
}

export async function addLoanPayment(
  input: CreateLoanPaymentInput,
): Promise<LoanPayment> {
  const spreadsheetId = await getSpreadsheetId();
  const payment: LoanPayment = {
    id: generateId(),
    loanId: input.loanId,
    date: input.date,
    amount: input.amount,
    direction: input.direction,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  return loanPaymentsRepo.create(spreadsheetId, payment);
}

export async function deleteLoanPayment(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await loanPaymentsRepo.remove(spreadsheetId, id);
}
