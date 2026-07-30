"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys, derivedKeys } from "@/hooks/keys";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import type { Category } from "@/types/domain";
import type { CreateCategoryInput } from "@/lib/schemas";

const INVALIDATE = [queryKeys.categories, ...derivedKeys] as const;

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.get<Category[]>("/api/categories"),
  });
}

export function useCreateCategory() {
  return useCrudMutation(
    (input: CreateCategoryInput) =>
      api.post<Category>("/api/categories", input),
    { successMessage: "Category created.", invalidate: INVALIDATE },
  );
}

export function useUpdateCategory() {
  return useCrudMutation(
    ({
      id,
      input,
    }: {
      id: string;
      input: Partial<CreateCategoryInput> & { isArchived?: boolean };
    }) => api.patch<Category>(`/api/categories/${id}`, input),
    { successMessage: "Category updated.", invalidate: INVALIDATE },
  );
}

export function useDeleteCategory() {
  return useCrudMutation(
    (id: string) => api.delete<{ id: string }>(`/api/categories/${id}`),
    { successMessage: "Category deleted.", invalidate: INVALIDATE },
  );
}
