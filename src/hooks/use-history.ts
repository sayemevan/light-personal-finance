"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/hooks/keys";
import type { ArchiveYears } from "@/lib/services/history.service";

export function useArchiveYears() {
  return useQuery({
    queryKey: queryKeys.archiveYears,
    queryFn: () => api.get<ArchiveYears>("/api/archive/years"),
    staleTime: 5 * 60 * 1000,
  });
}
