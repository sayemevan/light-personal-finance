/** Client-side parameters for a paginated, searchable, sortable list query. */
export interface ListQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  categoryId?: string;
  accountId?: string;
  year?: string;
}

/** Serialise list params into a query string, omitting empty values. */
export function buildListQuery(params: ListQueryParams): string {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("pageSize", String(params.pageSize));
  if (params.search) search.set("search", params.search);
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortDir) search.set("sortDir", params.sortDir);
  if (params.categoryId) search.set("categoryId", params.categoryId);
  if (params.accountId) search.set("accountId", params.accountId);
  if (params.year) search.set("year", params.year);
  return search.toString();
}
