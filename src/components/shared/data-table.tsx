"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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
}

type SortState = { columnId: string; dir: "asc" | "desc" } | null;

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = "Search…",
  toolbar,
  emptyState,
  onRowClick,
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortState>(null);

  const processed = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = data;

    if (term) {
      const searchable = columns.filter((c) => c.searchValue);
      rows = rows.filter((row) =>
        searchable.some((c) =>
          c.searchValue!(row).toLowerCase().includes(term),
        ),
      );
    }

    if (sort) {
      const column = columns.find((c) => c.id === sort.columnId);
      if (column?.sortValue) {
        const factor = sort.dir === "asc" ? 1 : -1;
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
  }, [data, columns, search, sort]);

  const toggleSort = (columnId: string) => {
    setSort((prev) => {
      if (prev?.columnId !== columnId) return { columnId, dir: "asc" };
      if (prev.dir === "asc") return { columnId, dir: "desc" };
      return null;
    });
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

      <div className="rounded-xl border">
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
            {processed.length === 0 ? (
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
              processed.map((row) => (
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
    </div>
  );
}
