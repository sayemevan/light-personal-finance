"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Plus, Receipt } from "lucide-react";

import {
  useDeleteExpenseWithUndo,
  useEntrySuggestions,
  useExpenses,
} from "@/hooks/use-expenses";
import { useArchiveYears } from "@/hooks/use-history";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useNewParam } from "@/hooks/use-new-param";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { Expense } from "@/types/domain";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryView } from "@/components/shared/query-view";
import { RowActions } from "@/components/shared/row-actions";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from "@/components/shared/data-table";
import {
  FilterSelect,
  ALL_VALUE,
} from "@/components/shared/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpenseFormDialog } from "@/components/forms/expense-form-dialog";

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const CURRENT_YEAR = String(new Date().getFullYear());

export default function ExpensesPage() {
  const { accountName, categoryName, accountOptions, categoryOptions } =
    useLookups();
  const currency = useCurrency();
  const deleteExpense = useDeleteExpenseWithUndo();
  const suggestions = useEntrySuggestions();
  const archiveYears = useArchiveYears();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Expense | undefined>();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [searchInput, setSearchInput] = React.useState("");
  const [sort, setSort] = React.useState<DataTableSort>(null);
  const [categoryFilter, setCategoryFilter] = React.useState(ALL_VALUE);
  const [accountFilter, setAccountFilter] = React.useState(ALL_VALUE);
  const [yearFilter, setYearFilter] = React.useState(ALL_VALUE);
  const [tagFilter, setTagFilter] = React.useState(ALL_VALUE);

  const search = useDebouncedValue(searchInput, 350);

  // Return to the first page whenever the query shape changes.
  React.useEffect(() => {
    setPage(1);
  }, [
    search,
    sort,
    categoryFilter,
    accountFilter,
    yearFilter,
    tagFilter,
    pageSize,
  ]);

  const expensesQuery = useExpenses({
    page,
    pageSize,
    search: search || undefined,
    sortBy: sort?.columnId,
    sortDir: sort?.dir,
    categoryId: categoryFilter === ALL_VALUE ? undefined : categoryFilter,
    accountId: accountFilter === ALL_VALUE ? undefined : accountFilter,
    year: yearFilter === ALL_VALUE ? CURRENT_YEAR : yearFilter,
    tag: tagFilter === ALL_VALUE ? undefined : tagFilter,
  });

  // Current and future years still live in the working sheet, so their rows
  // remain editable. Only past (archived) years are read-only.
  const isLive =
    yearFilter === ALL_VALUE || Number(yearFilter) >= Number(CURRENT_YEAR);
  const yearOptions = (archiveYears.data?.expense ?? [])
    .filter((year) => year !== CURRENT_YEAR)
    .map((year) => ({ label: year, value: year }));
  const hasActiveFilters =
    Boolean(search) ||
    categoryFilter !== ALL_VALUE ||
    accountFilter !== ALL_VALUE ||
    tagFilter !== ALL_VALUE ||
    !isLive;

  const tagOptions = (suggestions.data?.tags ?? []).map((tag) => ({
    label: `#${tag}`,
    value: tag,
  }));

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  useNewParam(openCreate);
  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setFormOpen(true);
  };

  const columns: DataTableColumn<Expense>[] = React.useMemo(() => {
    const result: DataTableColumn<Expense>[] = [
      {
        id: "date",
        mobile: "meta",
        header: "Date",
        cell: (row) => formatDate(row.date),
        sortValue: (row) => row.date,
      },
      {
        id: "category",
        mobile: "title",
        header: "Category",
        cell: (row) => categoryName(row.categoryId),
        sortValue: (row) => categoryName(row.categoryId),
      },
      {
        id: "account",
        mobile: "meta",
        header: "Account",
        cell: (row) => accountName(row.accountId),
        sortValue: (row) => accountName(row.accountId),
      },
      {
        id: "merchant",
        mobile: "meta",
        header: "Merchant",
        cell: (row) => row.merchant ?? "—",
      },
      {
        id: "method",
        mobile: "hidden",
        header: "Method",
        cell: (row) => (
          <Badge variant="secondary">
            {PAYMENT_METHOD_LABELS[row.paymentMethod]}
          </Badge>
        ),
      },
      {
        id: "receipt",
        mobile: "hidden",
        header: "Receipt",
        align: "center",
        cell: (row) =>
          row.receiptFileId ? (
            <Link
              href={`https://drive.google.com/file/d/${row.receiptFileId}/view`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
              aria-label="View receipt (opens in a new tab)"
              title="View receipt"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            "—"
          ),
      },
      {
        id: "tags",
        mobile: "meta",
        header: "Tags",
        cell: (row) =>
          row.tags?.length ? (
            <span className="text-primary">
              {row.tags.map((tag) => `#${tag}`).join(" ")}
            </span>
          ) : (
            "—"
          ),
      },
      {
        id: "amount",
        header: "Amount",
        align: "right",
        cell: (row) => (
          <span className="font-medium">
            {formatCurrency(row.amount, currency)}
          </span>
        ),
        sortValue: (row) => row.amount,
      },
    ];
    if (isLive) {
      result.push({
        id: "actions",
        header: "",
        align: "right",
        cell: (row) => (
          <RowActions
            onEdit={() => openEdit(row)}
            onDelete={() => deleteExpense(row.id, "Expense deleted")}
          />
        ),
      });
    }
    return result;
  }, [accountName, categoryName, currency, isLive, deleteExpense]);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Everything you spend, in one place."
        action={{ label: "Add expense", onClick: openCreate }}
      />

      <QueryView query={expensesQuery}>
        {(result) =>
          result.total === 0 && !hasActiveFilters ? (
            <EmptyState
              icon={Receipt}
              title="No expenses yet"
              description="Record your first expense to start tracking your spending. Attaching a receipt is optional."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add expense
                </Button>
              }
            />
          ) : (
            <DataTable
              data={result.items}
              columns={columns}
              getRowId={(row) => row.id}
              searchPlaceholder="Search merchant, notes…"
              onRowClick={isLive ? openEdit : undefined}
              server={{
                total: result.total,
                page: result.page,
                pageSize: result.pageSize,
                onPageChange: setPage,
                onPageSizeChange: setPageSize,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                search: searchInput,
                onSearchChange: setSearchInput,
                sort,
                onSortChange: setSort,
                isFetching: expensesQuery.isFetching,
              }}
              toolbar={
                <>
                  <FilterSelect
                    value={yearFilter}
                    onChange={setYearFilter}
                    options={yearOptions}
                    allLabel={`${CURRENT_YEAR} (Live)`}
                    placeholder="Year"
                  />
                  <FilterSelect
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={categoryOptions("expense")}
                    allLabel="All categories"
                    placeholder="Category"
                  />
                  <FilterSelect
                    value={accountFilter}
                    onChange={setAccountFilter}
                    options={accountOptions}
                    allLabel="All accounts"
                    placeholder="Account"
                  />
                  {tagOptions.length > 0 ? (

                    <FilterSelect

                      value={tagFilter}

                      onChange={setTagFilter}

                      options={tagOptions}

                      allLabel="All tags"

                      placeholder="Tag"

                    />

                  ) : null}
                </>
              }
            />
          )
        }
      </QueryView>

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editing}
      />
    </>
  );
}
