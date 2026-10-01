"use client";

import * as React from "react";
import { Plus, TrendingUp } from "lucide-react";

import { useIncome, useDeleteIncome } from "@/hooks/use-income";
import { useArchiveYears } from "@/hooks/use-history";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useNewParam } from "@/hooks/use-new-param";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Income } from "@/types/domain";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryView } from "@/components/shared/query-view";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { Button } from "@/components/ui/button";
import { IncomeFormDialog } from "@/components/forms/income-form-dialog";

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const CURRENT_YEAR = String(new Date().getFullYear());

export default function IncomePage() {
  const { accountName, categoryName, accountOptions, categoryOptions } =
    useLookups();
  const currency = useCurrency();
  const deleteIncome = useDeleteIncome();
  const archiveYears = useArchiveYears();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Income | undefined>();
  const [deleting, setDeleting] = React.useState<Income | undefined>();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [searchInput, setSearchInput] = React.useState("");
  const [sort, setSort] = React.useState<DataTableSort>(null);
  const [categoryFilter, setCategoryFilter] = React.useState(ALL_VALUE);
  const [accountFilter, setAccountFilter] = React.useState(ALL_VALUE);
  const [yearFilter, setYearFilter] = React.useState(ALL_VALUE);

  const search = useDebouncedValue(searchInput, 350);

  React.useEffect(() => {
    setPage(1);
  }, [search, sort, categoryFilter, accountFilter, yearFilter, pageSize]);

  const incomeQuery = useIncome({
    page,
    pageSize,
    search: search || undefined,
    sortBy: sort?.columnId,
    sortDir: sort?.dir,
    categoryId: categoryFilter === ALL_VALUE ? undefined : categoryFilter,
    accountId: accountFilter === ALL_VALUE ? undefined : accountFilter,
    year: yearFilter === ALL_VALUE ? CURRENT_YEAR : yearFilter,
  });

  // Current and future years still live in the working sheet, so their rows
  // remain editable. Only past (archived) years are read-only.
  const isLive =
    yearFilter === ALL_VALUE || Number(yearFilter) >= Number(CURRENT_YEAR);
  const yearOptions = (archiveYears.data?.income ?? [])
    .filter((year) => year !== CURRENT_YEAR)
    .map((year) => ({ label: year, value: year }));
  const hasActiveFilters =
    Boolean(search) ||
    categoryFilter !== ALL_VALUE ||
    accountFilter !== ALL_VALUE ||
    !isLive;

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  useNewParam(openCreate);
  const openEdit = (income: Income) => {
    setEditing(income);
    setFormOpen(true);
  };

  const columns: DataTableColumn<Income>[] = React.useMemo(() => {
    const result: DataTableColumn<Income>[] = [
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
        id: "notes",
        mobile: "hidden",
        header: "Notes",
        cell: (row) => row.notes ?? "—",
      },
      {
        id: "amount",
        header: "Amount",
        align: "right",
        cell: (row) => (
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
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
            onDelete={() => setDeleting(row)}
          />
        ),
      });
    }
    return result;
  }, [accountName, categoryName, currency, isLive]);

  return (
    <>
      <PageHeader
        title="Income"
        description="Track every source of money coming in."
        action={{ label: "Add income", onClick: openCreate }}
      />

      <QueryView query={incomeQuery}>
        {(result) =>
          result.total === 0 && !hasActiveFilters ? (
            <EmptyState
              icon={TrendingUp}
              title="No income recorded"
              description="Add your salary, freelance payments, or any other income to see it here."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add income
                </Button>
              }
            />
          ) : (
            <DataTable
              data={result.items}
              columns={columns}
              getRowId={(row) => row.id}
              searchPlaceholder="Search notes…"
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
                isFetching: incomeQuery.isFetching,
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
                    options={categoryOptions("income")}
                    allLabel="All categories"
                  />
                  <FilterSelect
                    value={accountFilter}
                    onChange={setAccountFilter}
                    options={accountOptions}
                    allLabel="All accounts"
                  />
                </>
              }
            />
          )
        }
      </QueryView>

      <IncomeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        income={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete income?"
        description="This will permanently remove this income entry."
        confirmLabel="Delete"
        loading={deleteIncome.isPending}
        onConfirm={() =>
          deleting &&
          deleteIncome.mutate(deleting.id, {
            onSuccess: () => setDeleting(undefined),
          })
        }
      />
    </>
  );
}
