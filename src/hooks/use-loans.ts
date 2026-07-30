"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Loan, LoanPayment } from "@/types/domain";
import type { CreateLoanInput, CreateLoanPaymentInput } from "@/lib/schemas";

const INVALIDATE = [queryKeys.loans, ...derivedKeys] as const;

export type LoanWithPayments = Loan & { payments: LoanPayment[] };

export function useLoans() {
  return useQuery({
    queryKey: queryKeys.loans,
    queryFn: () => api.get<Loan[]>("/api/loans"),
  });
}

export function useLoan(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.loan(id) : ["loans", "none"],
    queryFn: () => api.get<LoanWithPayments>(`/api/loans/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateLoan() {
  return useCrudMutation(
    (input: CreateLoanInput) => api.post<Loan>("/api/loans", input),
    { successMessage: "Loan added.", invalidate: INVALIDATE },
  );
}

export function useUpdateLoan() {
  return useCrudMutation(
    ({ id, input }: { id: string; input: Partial<CreateLoanInput> }) =>
      api.patch<Loan>(`/api/loans/${id}`, input),
    { successMessage: "Loan updated.", invalidate: INVALIDATE },
  );
}

export function useDeleteLoan() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/loans/${id}`),
    { successMessage: "Loan deleted.", invalidate: INVALIDATE },
  );
}

export function useAddLoanPayment() {
  return useCrudMutation(
    (input: CreateLoanPaymentInput) =>
      api.post<LoanPayment>("/api/loan-payments", input),
    { successMessage: "Payment recorded.", invalidate: INVALIDATE },
  );
}

export function useDeleteLoanPayment() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/loan-payments/${id}`),
    { successMessage: "Payment removed.", invalidate: INVALIDATE },
  );
}
