"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/hooks/keys";
import type { MonthlyPoint } from "@/types/domain";
import type {
  AccountSummaryRow,
  AssetSummary,
  CashFlowReport,
  CategorySummaryRow,
  ExportKind,
  OverviewReport,
  TagReport,
  InvestmentSummary,
  LoanSummary,
} from "@/types/reports";

export function useMonthlyReport(year: string) {
  return useQuery({
    queryKey: [...queryKeys.reports("monthly"), year],
    queryFn: () =>
      api.get<MonthlyPoint[]>(
        `/api/reports/monthly-expense?year=${encodeURIComponent(year)}`,
      ),
  });
}

export function useCategorySummary(year: string) {
  return useQuery({
    queryKey: [...queryKeys.reports("category"), year],
    queryFn: () =>
      api.get<CategorySummaryRow[]>(
        `/api/reports/category-summary?year=${encodeURIComponent(year)}`,
      ),
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

export function useOverviewReport(year: string, month: number) {
  return useQuery({
    queryKey: [...queryKeys.reports("overview"), year, month],
    queryFn: () =>
      api.get<OverviewReport>(
        `/api/reports/overview?year=${encodeURIComponent(year)}&month=${month}`,
      ),
  });
}

export function useCashFlowReport(year: string) {
  return useQuery({
    queryKey: [...queryKeys.reports("cash-flow"), year],
    queryFn: () =>
      api.get<CashFlowReport>(
        `/api/reports/cash-flow?year=${encodeURIComponent(year)}`,
      ),
  });
}

export function useTagReport(year: string) {
  return useQuery({
    queryKey: [...queryKeys.reports("tags"), year],
    queryFn: () =>
      api.get<TagReport>(`/api/reports/tags?year=${encodeURIComponent(year)}`),
  });
}

export interface ExportRequest {
  kind: ExportKind;
  year: string;
}

/** Fetch the CSV and hand it to the browser as a file download. */
export async function downloadExport({ kind, year }: ExportRequest) {
  const res = await fetch(
    `/api/export?kind=${kind}&year=${encodeURIComponent(year)}`,
  );
  if (!res.ok) {
    let message = "Export failed.";
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      message = json.error?.message ?? message;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new Error(message);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const fileName = encoded
    ? decodeURIComponent(encoded)
    : `${kind}-${year}.csv`;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return fileName;
}

export function useDriveExport() {
  return useMutation({
    mutationFn: (body: ExportRequest) =>
      api.post<{ fileId: string; webViewLink?: string; fileName: string }>(
        "/api/export/drive",
        body,
      ),
  });
}
