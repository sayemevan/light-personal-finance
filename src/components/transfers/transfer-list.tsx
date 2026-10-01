"use client";

import * as React from "react";
import { ArrowLeftRight, ArrowRight } from "lucide-react";

import { useTransfers, useDeleteTransferWithUndo } from "@/hooks/use-transfers";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Transfer } from "@/types/domain";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryView } from "@/components/shared/query-view";
import { RowActions } from "@/components/shared/row-actions";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from "@/components/shared/data-table";
import { FilterSelect, ALL_VALUE } from "@/components/shared/filter-select";
import { Button } from "@/components/ui/button";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

interface TransferListProps {
  onCreate: () => void;
  onEdit: (transfer: Transfer) => void;
}

/** Paginated history of transfers between the user's accounts. */
export function TransferList({ onCreate, onEdit }: TransferListProps) {
  const { accountName, accountOptions } = useLookups();
  const currency = useCurrency();
  const deleteTransfer = useDeleteTransferWithUndo();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [searchInput, setSearchInput] = React.useState("");
  const [sort, setSort] = React.useState<DataTableSort>(null);
  const [accountFilter, setAccountFilter] = React.useState(ALL_VALUE);
  const search = useDebouncedValue(searchInput, 350);

  React.useEffect(() => {
    setPage(1);
  }, [search, sort, accountFilter, pageSize]);

  const transfersQuery = useTransfers({
    page,
    pageSize,
    search: search || undefined,
    sortBy: sort?.columnId,
    sortDir: sort?.dir,
    accountId: accountFilter === ALL_VALUE ? undefined : accountFilter,
  });

  const columns: DataTableColumn<Transfer>[] = React.useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        mobile: "meta",
        cell: (row) => formatDate(row.date),
        sortValue: (row) => row.date,
      },
      {
        id: "from",
        header: "From",
        mobile: "title",
        cell: (row) => (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="truncate">{accountName(row.fromAccountId)}</span>
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground md:hidden"
              aria-hidden="true"
            />
            <span className="truncate md:hidden">
              {accountName(row.toAccountId)}
            </span>
          </span>
        ),
        sortValue: (row) => accountName(row.fromAccountId),
      },
      {
        id: "to",
        header: "To",
        mobile: "hidden",
        cell: (row) => accountName(row.toAccountId),
        sortValue: (row) => accountName(row.toAccountId),
      },
      {
        id: "notes",
        header: "Notes",
        mobile: "meta",
        cell: (row) => row.notes ?? "—",
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
      {
        id: "actions",
        header: "",
        align: "right",
        cell: (row) => (
          <RowActions
            onEdit={() => onEdit(row)}
            onDelete={() => deleteTransfer(row.id, "Transfer deleted")}
          />
        ),
      },
    ],
    [accountName, currency, deleteTransfer, onEdit],
  );

  return (
    <QueryView query={transfersQuery}>
      {(result) =>
        result.total === 0 && !search && accountFilter === ALL_VALUE ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transfers yet"
            description="Moving money from your bank to bKash, withdrawing cash or paying a credit card bill? Record it as a transfer so it isn't counted as spending."
            action={
              <Button onClick={onCreate}>
                <ArrowLeftRight className="h-4 w-4" />
                Transfer money
              </Button>
            }
          />
        ) : (
          <DataTable
            data={result.items}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search transfers…"
            onRowClick={onEdit}
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
              isFetching: transfersQuery.isFetching,
            }}
            toolbar={
              <FilterSelect
                value={accountFilter}
                onChange={setAccountFilter}
                options={accountOptions}
                allLabel="All accounts"
              />
            }
          />
        )
      }
    </QueryView>
  );
}
