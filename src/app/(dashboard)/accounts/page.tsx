"use client";

import * as React from "react";
import { ArrowLeftRight, Plus, Wallet } from "lucide-react";

import { useAccounts, useDeleteAccount } from "@/hooks/use-accounts";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_OPTIONS } from "@/lib/labels";
import type { Account } from "@/types/domain";
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
import { AccountFormDialog } from "@/components/forms/account-form-dialog";
import { TransferFormDialog } from "@/components/forms/transfer-form-dialog";
import { TransferList } from "@/components/transfers/transfer-list";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Transfer } from "@/types/domain";

export default function AccountsPage() {
  const accountsQuery = useAccounts();
  const currency = useCurrency();
  const deleteAccount = useDeleteAccount();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Account | undefined>();
  const [deleting, setDeleting] = React.useState<Account | undefined>();
  const [typeFilter, setTypeFilter] = React.useState(ALL_VALUE);
  const [tab, setTab] = React.useState<"accounts" | "transfers">("accounts");
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [editingTransfer, setEditingTransfer] = React.useState<
    Transfer | undefined
  >();
  const [transferFrom, setTransferFrom] = React.useState<string | undefined>();

  const openTransfer = React.useCallback((fromAccountId?: string) => {
    setEditingTransfer(undefined);
    setTransferFrom(fromAccountId);
    setTransferOpen(true);
  }, []);
  const editTransfer = React.useCallback((transfer: Transfer) => {
    setEditingTransfer(transfer);
    setTransferOpen(true);
  }, []);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (account: Account) => {
    setEditing(account);
    setFormOpen(true);
  };

  const columns: DataTableColumn<Account>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (row) => <span className="font-medium">{row.name}</span>,
        sortValue: (row) => row.name,
        searchValue: (row) => row.name,
      },
      {
        id: "type",
        header: "Type",
        cell: (row) => (
          <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[row.type]}</Badge>
        ),
        sortValue: (row) => row.type,
      },
      {
        id: "balance",
        header: "Current balance",
        align: "right",
        cell: (row) => (
          <span className="font-medium">
            {formatCurrency(row.currentBalance ?? 0, currency)}
          </span>
        ),
        sortValue: (row) => row.currentBalance ?? 0,
      },
      {
        id: "actions",
        header: "",
        align: "right",
        cell: (row) => (
          <RowActions
            onEdit={() => openEdit(row)}
            onDelete={() => setDeleting(row)}
          >
            <DropdownMenuItem onClick={() => openTransfer(row.id)}>
              <ArrowLeftRight className="h-4 w-4" />
              Transfer from here
            </DropdownMenuItem>
          </RowActions>
        ),
      },
    ],
    [currency, openTransfer],
  );

  const accountsList = (
      <QueryView query={accountsQuery}>
        {(accounts) =>
          accounts.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No accounts yet"
              description="Add the accounts you use so you can assign transactions and track balances."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add account
                </Button>
              }
            />
          ) : (
            <DataTable
              data={accounts.filter(
                (account) =>
                  typeFilter === ALL_VALUE || account.type === typeFilter,
              )}
              columns={columns}
              getRowId={(row) => row.id}
              searchPlaceholder="Search accounts…"
              onRowClick={openEdit}
              toolbar={
                <FilterSelect
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={ACCOUNT_TYPE_OPTIONS}
                  allLabel="All types"
                />
              }
            />
          )
        }
      </QueryView>
  );

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Cash, bank, credit cards, mobile banking and transfers between them."
        action={
          tab === "accounts"
            ? { label: "Add account", onClick: openCreate }
            : {
                label: "Transfer",
                onClick: () => openTransfer(),
                icon: ArrowLeftRight,
              }
        }
        actions={
          tab === "accounts" ? (
            <Button variant="outline" onClick={() => openTransfer()}>
              <ArrowLeftRight className="h-4 w-4" />
              Transfer
            </Button>
          ) : null
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "accounts" | "transfers")}
      >
        <TabsList className="h-11 w-full sm:h-9 sm:w-auto [&>*]:flex-1 [&>*]:py-1.5 sm:[&>*]:flex-none">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          {accountsList}
        </TabsContent>
        <TabsContent value="transfers" className="mt-4">
          <TransferList onCreate={() => openTransfer()} onEdit={editTransfer} />
        </TabsContent>
      </Tabs>

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
      />
      <TransferFormDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        transfer={editingTransfer}
        defaultFromAccountId={transferFrom}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete account?"
        description="Only an account with no transactions, loans, investments or assets can be deleted. This cannot be undone."
        confirmLabel="Delete"
        loading={deleteAccount.isPending}
        onConfirm={() =>
          deleting &&
          deleteAccount.mutate(deleting.id, {
            onSuccess: () => setDeleting(undefined),
          })
        }
      />
    </>
  );
}
