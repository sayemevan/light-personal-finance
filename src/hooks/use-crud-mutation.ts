"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Shared mutation helper: runs the mutation, invalidates the given query keys
 * on success, and surfaces success / error toasts. Keeps every module's CRUD
 * hooks free of boilerplate.
 */
export function useCrudMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options: {
    successMessage: string | ((data: TData) => string);
    invalidate: readonly (readonly unknown[])[];
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      for (const key of options.invalidate) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      toast.success(
        typeof options.successMessage === "function"
          ? options.successMessage(data)
          : options.successMessage,
      );
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    },
  });
}
