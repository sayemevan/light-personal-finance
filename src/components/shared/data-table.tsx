"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronsUpDown,
  Search,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  /**
   * Where this column goes in the phone list layout. Defaults: the first
   * column is the title, the first two right-aligned columns are the trailing
   * values, an `actions` column is the row menu, and the rest are metadata.
   */
  mobile?: MobileSlot;
}

export type MobileSlot =
  | "title"
  | "subtitle"
  | "meta"
  | "trailing"
  | "trailingSub"
  | "action"
  | "hidden";

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

/** Resolve each column's slot in the phone list layout. */
function mobileSlots<T>(columns: DataTableColumn<T>[]): MobileSlot[] {
  let rightSeen = 0;
  return columns.map((column, index) => {
    if (column.mobile) return column.mobile;
    if (column.id === "actions") return "action";
    if (index === 0) return "title";
    if (column.align === "right" && rightSeen < 2) {
      rightSeen += 1;
      return rightSeen === 1 ? "trailing" : "trailingSub";
    }
    return "meta";
  });
}

const NO_SORT = "__none__";

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

  const applySort = (updated: DataTableSort) => {
    if (isServer) server!.onSortChange(updated);
    else {
      setLocalSort(updated);
      setLocalPage(1);
    }
  };
  const toggleSort = (columnId: string) => applySort(nextSort(sort, columnId));
  const sortable = columns.filter((column) => column.sortValue);

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
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:left-2.5"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-11 rounded-full border-transparent bg-muted pl-10 shadow-none sm:h-9 sm:rounded-md sm:border-input sm:bg-transparent sm:pl-8 sm:shadow-sm"
          />
        </div>
        {toolbar || sortable.length > 0 ? (
          // Phones: one horizontally scrolling row of chips.
          <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {sortable.length > 0 ? (
              <Select
                value={sort ? `${sort.columnId}:${sort.dir}` : NO_SORT}
                onValueChange={(value) => {
                  if (value === NO_SORT) return applySort(null);
                  const [columnId = "", dir] = value.split(":");
                  applySort({ columnId, dir: dir === "desc" ? "desc" : "asc" });
                }}
              >
                <SelectTrigger
                  className="h-9 w-auto shrink-0 gap-2 rounded-full md:hidden [&>span]:shrink-0"
                  aria-label="Sort by"
                >
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SORT}>Default order</SelectItem>
                  {sortable.flatMap((column) => [
                    <SelectItem key={`${column.id}:asc`} value={`${column.id}:asc`}>
                      {column.header} ↑
                    </SelectItem>,
                    <SelectItem key={`${column.id}:desc`} value={`${column.id}:desc`}>
                      {column.header} ↓
                    </SelectItem>,
                  ])}
                </SelectContent>
              </Select>
            ) : null}
            {toolbar}
          </div>
        ) : null}
      </div>

      <MobileList
        rows={rows}
        columns={columns}
        getRowId={getRowId}
        onRowClick={onRowClick}
        emptyState={emptyState}
        dimmed={server?.isFetching}
      />

      <div
        className={cn(
          "hidden rounded-xl border transition-opacity md:block",
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

function isBlank(node: React.ReactNode) {
  return node === null || node === undefined || node === "" || node === "—";
}

/** Phone layout: a native-style list of two-line rows. */
function MobileList<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  emptyState,
  dimmed,
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  dimmed?: boolean;
}) {
  const slots = mobileSlots(columns);
  const pick = (slot: MobileSlot) =>
    columns.filter((_, index) => slots[index] === slot);

  const title = pick("title");
  const subtitle = [...pick("subtitle"), ...pick("meta")];
  const trailing = pick("trailing");
  const trailingSub = pick("trailingSub");
  const action = pick("action");

  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border md:hidden">
        {emptyState ?? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No results found.
          </div>
        )}
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "divide-y overflow-hidden rounded-2xl border bg-card transition-opacity md:hidden",
        dimmed && "opacity-60",
      )}
    >
      {rows.map((row) => {
        const details = subtitle
          .map((column) => ({ id: column.id, node: column.cell(row) }))
          .filter((item) => !isBlank(item.node));
        return (
          <li
            key={getRowId(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              "flex min-h-[4.5rem] items-center gap-3 py-3 pl-4 pr-2",
              onRowClick && "cursor-pointer select-none active:bg-accent",
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="truncate font-medium leading-tight">
                {title.map((column) => (
                  <React.Fragment key={column.id}>{column.cell(row)}</React.Fragment>
                ))}
              </div>
              {details.length > 0 ? (
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-tight text-muted-foreground">
                  {details.map((item, index) => (
                    <React.Fragment key={item.id}>
                      {index > 0 ? <span aria-hidden="true">·</span> : null}
                      <span className="max-w-full truncate">{item.node}</span>
                    </React.Fragment>
                  ))}
                </div>
              ) : null}
            </div>
            {trailing.length > 0 || trailingSub.length > 0 ? (
              <div className="shrink-0 space-y-1 text-right">
                {trailing.map((column) => (
                  <div key={column.id} className="font-semibold leading-tight">
                    {column.cell(row)}
                  </div>
                ))}
                {trailingSub.map((column) => (
                  <div
                    key={column.id}
                    className="text-xs leading-tight text-muted-foreground"
                  >
                    {column.cell(row)}
                  </div>
                ))}
              </div>
            ) : null}
            {action.map((column) => (
              <div key={column.id} className="shrink-0">
                {column.cell(row)}
              </div>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
