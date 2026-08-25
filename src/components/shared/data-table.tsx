"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  /** Provide to include the column's text in the global search. */
  searchValue?: (row: T) => string;
  align?: "left" | "right" | "center";
  className?: string;
}

export type DataTableSort = { columnId: string; dir: "asc" | "desc" } | null;

/**
 * Controls for a server-driven table. When supplied, the table stops filtering,
 * sorting and slicing locally and instead reflects the given page while
 * delegating every interaction back to the parent.
 */
export interface DataTableServer {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  search: string;
  onSearchChange: (value: string) => void;
  sort: DataTableSort;
  onSortChange: (sort: DataTableSort) => void;
  isFetching?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  searchPlaceholder?: string;
  /** Extra controls (filters, add button) rendered in the toolbar. */
  toolbar?: React.ReactNode;
  /** Shown when there are no rows after search/filter. */
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  /** Provide to switch to server-driven pagination / search / sort. */
  server?: DataTableServer;
  /** Rows per page in client mode (default 15). */
  pageSize?: number;
  pageSizeOptions?: number[];
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/** Cycle a column through asc → desc → unsorted. */
function nextSort(prev: DataTableSort, columnId: string): DataTableSort {
  if (prev?.columnId !== columnId) return { columnId, dir: "asc" };
  if (prev.dir === "asc") return { columnId, dir: "desc" };
  return null;
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = "Search…",
  toolbar,
  emptyState,
  onRowClick,
  server,
  pageSize: clientPageSize = 15,
  pageSizeOptions = [15, 30, 50, 100],
}: DataTableProps<T>) {
  const isServer = Boolean(server);

  // Client-mode state (ignored in server mode).
  const [localSearch, setLocalSearch] = React.useState("");
  const [localSort, setLocalSort] = React.useState<DataTableSort>(null);
  const [localPage, setLocalPage] = React.useState(1);
  const [localPageSize, setLocalPageSize] = React.useState(clientPageSize);

  const search = isServer ? server!.search : localSearch;
  const sort = isServer ? server!.sort : localSort;

  const setSearch = (value: string) => {
    if (isServer) server!.onSearchChange(value);
    else {
      setLocalSearch(value);
      setLocalPage(1);
    }
  };

  const toggleSort = (columnId: string) => {
    const updated = nextSort(sort, columnId);
    if (isServer) server!.onSortChange(updated);
    else {
      setLocalSort(updated);
      setLocalPage(1);
    }
  };

  // In client mode, search + sort the full dataset before paginating it.
  const processed = React.useMemo(() => {
    if (isServer) return data;
    const term = localSearch.trim().toLowerCase();
    let rows = data;

    if (term) {
      const searchable = columns.filter((c) => c.searchValue);
      rows = rows.filter((row) =>
        searchable.some((c) =>
          c.searchValue!(row).toLowerCase().includes(term),
        ),
      );
    }

    if (localSort) {
      const column = columns.find((c) => c.id === localSort.columnId);
      if (column?.sortValue) {
        const factor = localSort.dir === "asc" ? 1 : -1;
        rows = [...rows].sort((a, b) => {
          const av = column.sortValue!(a);
          const bv = column.sortValue!(b);
          if (typeof av === "number" && typeof bv === "number") {
            return (av - bv) * factor;
          }
          return String(av).localeCompare(String(bv)) * factor;
        });
      }
    }

    return rows;
  }, [isServer, data, columns, localSearch, localSort]);

  const total = isServer ? server!.total : processed.length;
  const pageSize = isServer ? server!.pageSize : localPageSize;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = isServer ? server!.page : Math.min(localPage, pageCount);

  // Keep the client page valid as the filtered result shrinks.
  React.useEffect(() => {
    if (!isServer && localPage > pageCount) setLocalPage(pageCount);
  }, [isServer, localPage, pageCount]);

  const rows = React.useMemo(() => {
    if (isServer) return processed;
    const start = (page - 1) * pageSize;
    return processed.slice(start, start + pageSize);
  }, [isServer, processed, page, pageSize]);

  const handlePageChange = (nextPage: number) => {
    if (isServer) server!.onPageChange(nextPage);
    else setLocalPage(nextPage);
  };

  const handlePageSizeChange = (size: number) => {
    if (isServer) server!.onPageSizeChange?.(size);
    else {
      setLocalPageSize(size);
      setLocalPage(1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-8"
          />
        </div>
        {toolbar ? (
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
        ) : null}
      </div>

      <div
        className={cn(
          "rounded-xl border transition-opacity",
          server?.isFetching && "opacity-60",
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const isSorted = sort?.columnId === column.id;
                return (
                  <TableHead
                    key={column.id}
                    scope="col"
                    aria-sort={
                      column.sortValue
                        ? isSorted
                          ? sort?.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className={cn(
                      column.align ? alignClass[column.align] : undefined,
                      column.className,
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className={cn(
                          "inline-flex items-center gap-1 hover:text-foreground",
                          column.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {column.header}
                        {isSorted ? (
                          sort?.dir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDown
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )
                        ) : (
                          <ChevronsUpDown
                            className="h-3.5 w-3.5 opacity-50"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-40 p-0">
                  {emptyState ?? (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                      No results found.
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        column.align ? alignClass[column.align] : undefined,
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={isServer ? server!.pageSizeOptions : pageSizeOptions}
          isLoading={server?.isFetching}
        />
      ) : null}
    </div>
  );
}
