"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { buildListQuery, type ListQueryParams } from "@/hooks/list-params";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import type { Transfer } from "@/types/domain";
import type { Paginated } from "@/types/api";
import type { CreateTransferInput } from "@/lib/schemas";

const INVALIDATE = [queryKeys.transfers, ...derivedKeys] as const;

export function useTransfers(params: ListQueryParams) {
  return useQuery({
    queryKey: [...queryKeys.transfers, params],
    queryFn: () =>
      api.get<Paginated<Transfer>>(`/api/transfers?${buildListQuery(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateTransfer() {
  return useCrudMutation(
    (input: CreateTransferInput) => api.post<Transfer>("/api/transfers", input),
    { successMessage: "Transfer recorded.", invalidate: INVALIDATE },
  );
}

export function useUpdateTransfer() {
  return useCrudMutation(
    ({ id, input }: { id: string; input: Partial<CreateTransferInput> }) =>
      api.patch<Transfer>(`/api/transfers/${id}`, input),
    { successMessage: "Transfer updated.", invalidate: INVALIDATE },
  );
}

export function useDeleteTransferWithUndo() {
  return useUndoableDelete({
    listKey: queryKeys.transfers,
    endpoint: "/api/transfers",
    invalidate: INVALIDATE,
  });
}
