"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";

export interface AppSettings {
  currency: string;
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api.get<AppSettings>("/api/settings"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Currency code for formatting, defaulting to USD while settings load. */
export function useCurrency(): string {
  const { data } = useSettings();
  return data?.currency ?? "USD";
}

export function useUpdateSettings() {
  return useCrudMutation(
    (input: Partial<AppSettings>) =>
      api.patch<AppSettings>("/api/settings", input),
    { successMessage: "Settings saved.", invalidate: [queryKeys.settings] },
  );
}
