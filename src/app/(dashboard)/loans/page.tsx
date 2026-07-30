"use client";

import * as React from "react";
import { Eye, HandCoins, Plus } from "lucide-react";

import { useLoans, useDeleteLoan } from "@/hooks/use-loans";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  LOAN_STATUS_LABELS,
  LOAN_STATUS_OPTIONS,
  LOAN_TYPE_LABELS,
  LOAN_TYPE_OPTIONS,
} from "@/lib/labels";
import type { Loan, LoanStatus } from "@/types/domain";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoanFormDialog } from "@/components/forms/loan-form-dialog";
import { LoanDetailSheet } from "@/components/loans/loan-detail-sheet";

const STATUS_VARIANT: Record<
  LoanStatus,
  "secondary" | "success" | "destructive"
> = {
  active: "secondary",
  settled: "success",
  overdue: "destructive",
};

export default function LoansPage() {
  const loansQuery = useLoans();
  const currency = useCurrency();
  const { accountName } = useLookups();
  const deleteLoan = useDeleteLoan();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Loan | undefined>();
  const [deleting, setDeleting] = React.useState<Loan | undefined>();
  const [detailId, setDetailId] = React.useState<string | undefined>();
  const [typeFilter, setTypeFilter] = React.useState(ALL_VALUE);
  const [statusFilter, setStatusFilter] = React.useState(ALL_VALUE);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openDetail = (loan: Loan) => setDetailId(loan.id);

  const columns: DataTableColumn<Loan>[] = React.useMemo(
    () => [
      {
        id: "person",
        header: "Person / Institution",
        cell: (row) => <span className="font-medium">{row.person}</span>,
        sortValue: (row) => row.person,
        searchValue: (row) => `${row.person} ${row.notes ?? ""}`,
      },
      {
        id: "type",
        header: "Type",
        cell: (row) => (
          <Badge variant={row.type === "lent" ? "success" : "secondary"}>
            {LOAN_TYPE_LABELS[row.type]}
          </Badge>
        ),
        sortValue: (row) => row.type,
      },
      {
        id: "principal",
        header: "Amount",
        align: "right",
        cell: (row) => formatCurrency(row.principal, currency),
        sortValue: (row) => row.principal,
      },
      {
        id: "remaining",
        header: "Remaining",
        align: "right",
        cell: (row) => (
          <span className="font-medium">
            {formatCurrency(row.remainingBalance ?? 0, currency)}
          </span>
        ),
        sortValue: (row) => row.remainingBalance ?? 0,
      },
      {
        id: "account",
        header: "Account",
        cell: (row) => (row.accountId ? accountName(row.accountId) : "—"),
        sortValue: (row) => (row.accountId ? accountName(row.accountId) : ""),
      },
      {
        id: "due",
        header: "Due date",
        cell: (row) => (row.dueDate ? formatDate(row.dueDate) : "—"),
        sortValue: (row) => row.dueDate ?? "",
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <Badge variant={STATUS_VARIANT[row.status]}>
            {LOAN_STATUS_LABELS[row.status]}
          </Badge>
        ),
        sortValue: (row) => row.status,
      },
      {
        id: "actions",
        header: "",
        align: "right",
        cell: (row) => (
          <RowActions
            onEdit={() => {
              setEditing(row);
              setFormOpen(true);
            }}
            onDelete={() => setDeleting(row)}
          >
            <DropdownMenuItem onClick={() => openDetail(row)}>
              <Eye className="h-4 w-4" />
              View details
            </DropdownMenuItem>
          </RowActions>
        ),
      },
    ],
    [currency, accountName],
  );

  return (
    <>
      <PageHeader
        title="Personal loans"
        description="Track money you have borrowed and money you have lent."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add loan
          </Button>
        }
      />

      <QueryView query={loansQuery}>
        {(loans) =>
          loans.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No loans tracked"
              description="Add a loan to record the person, amount, dates, and payment history. Remaining balances are calculated automatically."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add loan
                </Button>
              }
            />
          ) : (
            <DataTable
              data={loans.filter(
                (loan) =>
                  (typeFilter === ALL_VALUE || loan.type === typeFilter) &&
                  (statusFilter === ALL_VALUE || loan.status === statusFilter),
              )}
              columns={columns}
              getRowId={(row) => row.id}
              searchPlaceholder="Search person, notes…"
              onRowClick={openDetail}
              toolbar={
                <>
                  <FilterSelect
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={LOAN_TYPE_OPTIONS}
                    allLabel="All types"
                  />
                  <FilterSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={LOAN_STATUS_OPTIONS}
                    allLabel="All statuses"
                  />
                </>
              }
            />
          )
        }
      </QueryView>

      <LoanFormDialog open={formOpen} onOpenChange={setFormOpen} loan={editing} />
      <LoanDetailSheet
        loanId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(undefined)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete loan?"
        description="This will remove the loan and all of its payment history."
        confirmLabel="Delete"
        loading={deleteLoan.isPending}
        onConfirm={() =>
          deleting &&
          deleteLoan.mutate(deleting.id, {
            onSuccess: () => setDeleting(undefined),
          })
        }
      />
    </>
  );
}
