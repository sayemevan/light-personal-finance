"use client";

import * as React from "react";

export interface UsePaginationResult<T> {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  total: number;
  pageCount: number;
  pageItems: T[];
}

/**
 * Client-side pagination over an in-memory array. Keeps the current page valid
 * as the underlying data shrinks (e.g. after a delete or filter change).
 */
export function usePagination<T>(
  items: T[],
  initialPageSize = 15,
): UsePaginationResult<T> {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSizeState] = React.useState(initialPageSize);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const setPageSize = React.useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    page: currentPage,
    setPage,
    pageSize,
    setPageSize,
    total,
    pageCount,
    pageItems,
  };
}
