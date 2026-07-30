"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Asset } from "@/types/domain";
import type { CreateAssetInput } from "@/lib/schemas";

const INVALIDATE = [queryKeys.assets, ...derivedKeys] as const;

export function useAssets() {
  return useQuery({
    queryKey: queryKeys.assets,
    queryFn: () => api.get<Asset[]>("/api/assets"),
  });
}

export function useCreateAsset() {
  return useCrudMutation(
    (input: CreateAssetInput) => api.post<Asset>("/api/assets", input),
    { successMessage: "Asset added.", invalidate: INVALIDATE },
  );
}

export function useUpdateAsset() {
  return useCrudMutation(
    ({ id, input }: { id: string; input: Partial<CreateAssetInput> }) =>
      api.patch<Asset>(`/api/assets/${id}`, input),
    { successMessage: "Asset updated.", invalidate: INVALIDATE },
  );
}

export function useDeleteAsset() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/assets/${id}`),
    { successMessage: "Asset deleted.", invalidate: INVALIDATE },
  );
}
