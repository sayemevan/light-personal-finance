import "server-only";
import type { Paginated } from "@/types/api";

/** How a collection should be searched, sorted and sliced into a page. */
export interface CollectionQuery {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

/** Declares how one logical column maps to a searchable / sortable value. */
export interface FieldSpec<T> {
  key: string;
  get: (row: T) => string | number | undefined;
  searchable?: boolean;
  sortable?: boolean;
}

/**
 * Applies free-text search, single-column sort and page slicing to an
 * in-memory collection. Sheet-backed services read a whole tab and then hand
 * the rows here so only one page is ever sent to the client.
 */
export function queryCollection<T>(
  rows: T[],
  fields: FieldSpec<T>[],
  query: CollectionQuery,
): Paginated<T> {
  let result = rows;

  const term = query.search?.trim().toLowerCase();
  if (term) {
    const searchable = fields.filter((f) => f.searchable);
    result = result.filter((row) =>
      searchable.some((f) =>
        String(f.get(row) ?? "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }

  if (query.sortBy) {
    const field = fields.find((f) => f.key === query.sortBy && f.sortable);
    if (field) {
      const factor = query.sortDir === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => {
        const av = field.get(a);
        const bv = field.get(b);
        if (typeof av === "number" && typeof bv === "number") {
          return (av - bv) * factor;
        }
        return String(av ?? "").localeCompare(String(bv ?? "")) * factor;
      });
    }
  }

  const total = result.length;
  const start = (query.page - 1) * query.pageSize;
  const items = result.slice(start, start + query.pageSize);
  return { items, total, page: query.page, pageSize: query.pageSize };
}
