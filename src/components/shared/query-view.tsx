"use client";

import * as React from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";

interface QueryViewProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => React.ReactNode;
  loading?: React.ReactNode;
}

/**
 * Standardises the loading / error / success rendering of a React Query result
 * so pages stay focused on their content.
 */
export function QueryView<T>({ query, children, loading }: QueryViewProps<T>) {
  if (query.isLoading) {
    return <>{loading ?? <TableSkeleton />}</>;
  }
  if (query.isError) {
    return (
      <ErrorState
        description={
          query.error instanceof Error
            ? query.error.message
            : "Failed to load data."
        }
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.data === undefined) {
    return <>{loading ?? <TableSkeleton />}</>;
  }
  return <>{children(query.data)}</>;
}
