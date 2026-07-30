"use client";

import * as React from "react";
import { Plus, TrendingUp } from "lucide-react";

import { useIncome, useDeleteIncome } from "@/hooks/use-income";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
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
} from "@/components/shared/data-table";
import {
  FilterSelect,
  ALL_VALUE,
} from "@/components/shared/filter-select";
import { Button } from "@/components/ui/button";
import { IncomeFormDialog } from "@/components/forms/income-form-dialog";

export default function IncomePage() {
  const incomeQuery = useIncome();
  const { accountName, categoryName, accountOptions, categoryOptions } =
    useLookups();
  const currency = useCurrency();
  const deleteIncome = useDeleteIncome();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Income | undefined>();
  const [deleting, setDeleting] = React.useState<Income | undefined>();
  const [categoryFilter, setCategoryFilter] = React.useState(ALL_VALUE);
  const [accountFilter, setAccountFilter] = React.useState(ALL_VALUE);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (income: Income) => {
    setEditing(income);
    setFormOpen(true);
  };

  const columns: DataTableColumn<Income>[] = React.useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        cell: (row) => formatDate(row.date),
        sortValue: (row) => row.date,
        searchValue: (row) => row.date,
      },
      {
        id: "category",
        header: "Category",
        cell: (row) => categoryName(row.categoryId),
        sortValue: (row) => categoryName(row.categoryId),
        searchValue: (row) => categoryName(row.categoryId),
      },
      {
        id: "account",
        header: "Account",
        cell: (row) => accountName(row.accountId),
        sortValue: (row) => accountName(row.accountId),
        searchValue: (row) => accountName(row.accountId),
      },
      {
        id: "notes",
        header: "Notes",
        cell: (row) => row.notes ?? "—",
        searchValue: (row) => row.notes ?? "",
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
      {
        id: "actions",
        header: "",
        align: "right",
        cell: (row) => (
          <RowActions
            onEdit={() => openEdit(row)}
            onDelete={() => setDeleting(row)}
          />
        ),
      },
    ],
    [accountName, categoryName, currency],
  );

  return (
    <>
      <PageHeader
        title="Income"
        description="Track every source of money coming in."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add income
          </Button>
        }
      />

      <QueryView query={incomeQuery}>
        {(income) =>
          income.length === 0 ? (
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
              data={income.filter(
                (entry) =>
                  (categoryFilter === ALL_VALUE ||
                    entry.categoryId === categoryFilter) &&
                  (accountFilter === ALL_VALUE ||
                    entry.accountId === accountFilter),
              )}
              columns={columns}
              getRowId={(row) => row.id}
              searchPlaceholder="Search notes…"
              onRowClick={openEdit}
              toolbar={
                <>
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
