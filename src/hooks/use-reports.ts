"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/hooks/keys";
import type { MonthlyPoint } from "@/types/domain";
import type {
  AccountSummaryRow,
  CategorySummaryRow,
  LoanSummary,
} from "@/types/reports";

export function useMonthlyReport() {
  return useQuery({
    queryKey: queryKeys.reports("monthly"),
    queryFn: () => api.get<MonthlyPoint[]>("/api/reports/monthly-expense"),
  });
}

export function useCategorySummary() {
  return useQuery({
    queryKey: queryKeys.reports("category"),
    queryFn: () =>
      api.get<CategorySummaryRow[]>("/api/reports/category-summary"),
  });
}

export function useAccountSummary() {
  return useQuery({
    queryKey: queryKeys.reports("account"),
    queryFn: () => api.get<AccountSummaryRow[]>("/api/reports/account-summary"),
  });
}

export function useLoanSummary() {
  return useQuery({
    queryKey: queryKeys.reports("loan"),
    queryFn: () => api.get<LoanSummary>("/api/reports/loan-summary"),
  });
}
