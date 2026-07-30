"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/hooks/keys";
import type { MonthlyPoint } from "@/types/domain";
import type {
  AccountSummaryRow,
  AssetSummary,
  CategorySummaryRow,
  InvestmentSummary,
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

export function useInvestmentSummary() {
  return useQuery({
    queryKey: queryKeys.reports("investment"),
    queryFn: () =>
      api.get<InvestmentSummary>("/api/reports/investment-summary"),
  });
}

export function useAssetSummary() {
  return useQuery({
    queryKey: queryKeys.reports("asset"),
    queryFn: () => api.get<AssetSummary>("/api/reports/asset-summary"),
  });
}
