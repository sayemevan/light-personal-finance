import "server-only";
import { loansRepo, loanPaymentsRepo } from "@/lib/repositories";
import { loadLedger } from "@/lib/services/ledger.service";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { computeLoanRemaining, effectiveLoanStatus } from "@/lib/finance";
import { generateId } from "@/lib/id";
import { formatCurrency } from "@/lib/format";
import { getSettings } from "@/lib/services/settings.service";
import { AppError } from "@/lib/errors";
import type { Loan, LoanPayment, LoanType } from "@/types/domain";
import type { CreateLoanInput, CreateLoanPaymentInput } from "@/lib/schemas";

/** List loans with computed remaining balances, optionally filtered by type. */
export async function listLoans(type?: LoanType): Promise<Loan[]> {
  const { loans, loanPayments: payments } = await loadLedger();
  return loans
    .filter((loan) => (type ? loan.type === type : true))
    .map((loan) => {
      const remainingBalance = computeLoanRemaining(loan, payments);
      return {
        ...loan,
        remainingBalance,
        storedStatus: loan.status,
        status: effectiveLoanStatus(loan, remainingBalance),
      };
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

export async function getLoan(
  id: string,
): Promise<Loan & { payments: LoanPayment[] }> {
  const ledger = await loadLedger();
  const loan = ledger.loans.find((l) => l.id === id);
  if (!loan) throw AppError.notFound("Loan not found.");

  const payments = ledger.loanPayments
    .filter((p) => p.loanId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const remainingBalance = computeLoanRemaining(loan, payments);
  return {
    ...loan,
    payments,
    remainingBalance,
    storedStatus: loan.status,
    status: effectiveLoanStatus(loan, remainingBalance),
  };
}

export async function createLoan(input: CreateLoanInput): Promise<Loan> {
  const spreadsheetId = await getSpreadsheetId();
  const dueDate = input.dueDate || undefined;
  if (dueDate && dueDate < input.borrowDate) {
    throw AppError.validation("The due date can't be before the loan date.", {
      dueDate: ["Before the loan date"],
    });
  }
  const loan: Loan = {
    id: generateId(),
    type: input.type,
    person: input.person,
    accountId: input.existing ? undefined : input.accountId,
    principal: input.principal,
    interestRate: input.interestRate,
    borrowDate: input.borrowDate,
    dueDate,
    status: input.status === "overdue" ? "active" : input.status,
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
  const current = await loansRepo.findById(spreadsheetId, id);
  if (!current) throw AppError.notFound("Loan not found.");

  if (input.type && input.type !== current.type) {
    const hasPayments = (await loanPaymentsRepo.list(spreadsheetId)).some(
      (p) => p.loanId === id,
    );
    if (hasPayments) {
      throw AppError.validation(
        "This loan already has repayments, so it can't switch between borrowed and lent. Delete it and add it again instead.",
        { type: ["Has repayments"] },
      );
    }
  }

  // "Overdue" is worked out from the due date, never stored, so an edit can't
  // freeze it. Only "active" and a manual "settled" are saved.
  const status =
    input.status === "overdue" ? ("active" as const) : input.status;
  const { existing, ...fields } = input;
  const patch: Partial<Loan> = { ...fields, status, dueDate: input.dueDate || undefined };
  if (input.dueDate === undefined) delete patch.dueDate;
  // A previous loan has no account, so it never changes a balance.
  if (existing) patch.accountId = undefined;
  if (input.status === undefined) delete patch.status;
  // 0 means "no interest"; store it as empty.
  if (input.interestRate === 0) patch.interestRate = undefined;

  const borrowDate = patch.borrowDate ?? current.borrowDate;
  const dueDate = "dueDate" in patch ? patch.dueDate : current.dueDate;
  if (dueDate && dueDate < borrowDate) {
    throw AppError.validation("The due date can't be before the loan date.", {
      dueDate: ["Before the loan date"],
    });
  }
  return loansRepo.update(spreadsheetId, id, patch);
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
  const loan = await loansRepo.findById(spreadsheetId, input.loanId);
  if (!loan) throw AppError.notFound("Loan not found.");

  const expected = loan.type === "lent" ? "receipt" : "payment";
  if (input.direction !== expected) {
    throw AppError.validation(
      loan.type === "lent"
        ? "Money lent is repaid with a receipt, not a payment."
        : "A borrowed loan is repaid with a payment, not a receipt.",
    );
  }

  const payments = (await loanPaymentsRepo.list(spreadsheetId)).filter(
    (p) => p.loanId === loan.id,
  );
  const remaining = computeLoanRemaining(loan, payments);
  if (input.amount > remaining + 0.005) {
    const { currency } = await getSettings();
    throw AppError.validation(
      remaining <= 0
        ? "This loan is already fully repaid."
        : `That's more than the ${formatCurrency(remaining, currency)} still owed.`,
      { amount: ["More than the remaining balance"] },
    );
  }

  const payment: LoanPayment = {
    id: generateId(),
    loanId: input.loanId,
    date: input.date,
    amount: input.amount,
    direction: input.direction,
    accountId: input.accountId,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  return loanPaymentsRepo.create(spreadsheetId, payment);
}

export async function deleteLoanPayment(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await loanPaymentsRepo.remove(spreadsheetId, id);
}
