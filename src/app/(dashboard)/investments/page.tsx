"use client";

import * as React from "react";
import {
  Eye,
  LineChart,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  useInvestments,
  useDeleteInvestment,
} from "@/hooks/use-investments";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  INVESTMENT_TYPE_LABELS,
  INVESTMENT_TYPE_OPTIONS,
} from "@/lib/labels";
import type { Investment } from "@/types/domain";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryView } from "@/components/shared/query-view";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RowActions } from "@/components/shared/row-actions";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { FilterSelect, ALL_VALUE } from "@/components/shared/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { InvestmentFormDialog } from "@/components/forms/investment-form-dialog";
import { InvestmentDetailSheet } from "@/components/investments/investment-detail-sheet";

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function InvestmentsPage() {
  const investmentsQuery = useInvestments();
  const { accountName } = useLookups();
  const currency = useCurrency();
  const deleteInvestment = useDeleteInvestment();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Investment | undefined>();
  const [deleting, setDeleting] = React.useState<Investment | undefined>();
  const [detailId, setDetailId] = React.useState<string | undefined>();
  const [typeFilter, setTypeFilter] = React.useState(ALL_VALUE);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (investment: Investment) => {
    setEditing(investment);
    setFormOpen(true);
  };
  const openDetail = (investment: Investment) => setDetailId(investment.id);

  const columns: DataTableColumn<Investment>[] = React.useMemo(
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
        mobile: "meta",
        header: "Type",
        cell: (row) => (
          <Badge variant="secondary">
            {INVESTMENT_TYPE_LABELS[row.type]}
          </Badge>
        ),
        sortValue: (row) => row.type,
      },
      {
        id: "invested",
        mobile: "hidden",
        header: "Invested",
        align: "right",
        cell: (row) => formatCurrency(row.amountInvested, currency),
        sortValue: (row) => row.amountInvested,
      },
      {
        id: "value",
        mobile: "trailing",
        header: "Current value",
        align: "right",
        cell: (row) => (
          <span className="font-medium">
            {formatCurrency(row.currentValue, currency)}
          </span>
        ),
        sortValue: (row) => row.currentValue,
      },
      {
        id: "gain",
        mobile: "trailingSub",
        header: "Gain / loss",
        align: "right",
        cell: (row) => {
          const gain = row.gain ?? 0;
          return (
            <span
              className={cn(
                "font-medium",
                gain > 0 && "text-emerald-600 dark:text-emerald-400",
                gain < 0 && "text-red-600 dark:text-red-400",
              )}
            >
              {gain > 0 ? "+" : ""}
              {formatCurrency(gain, currency)}
              <span className="ml-1 text-xs text-muted-foreground">
                ({formatPercent(row.returnPct ?? 0)})
              </span>
            </span>
          );
        },
        sortValue: (row) => row.gain ?? 0,
      },
      {
        id: "account",
        mobile: "hidden",
        header: "Paid from",
        cell: (row) =>
          row.accountId ? (
            accountName(row.accountId)
          ) : (
            <span className="text-muted-foreground">External</span>
          ),
      },
      {
        id: "date",
        mobile: "hidden",
        header: "Purchased",
        cell: (row) => formatDate(row.purchaseDate),
        sortValue: (row) => row.purchaseDate,
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
        title="Investments"
        description="Track your holdings and how they are performing."
        action={{ label: "Add investment", onClick: openCreate }}
      />

      <QueryView query={investmentsQuery}>
        {(investments) =>
          investments.length === 0 ? (
            <EmptyState
              icon={LineChart}
              title="No investments yet"
              description="Add your stocks, funds, crypto, deposits and other holdings to track their value and returns."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add investment
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              <InvestmentSummary
                investments={investments}
                currency={currency}
              />
              <DataTable
                data={investments.filter(
                  (investment) =>
                    typeFilter === ALL_VALUE || investment.type === typeFilter,
                )}
                columns={columns}
                getRowId={(row) => row.id}
                searchPlaceholder="Search investments…"
                onRowClick={openDetail}
                toolbar={
                  <FilterSelect
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={INVESTMENT_TYPE_OPTIONS}
                    allLabel="All types"
                  />
                }
              />
            </div>
          )
        }
      </QueryView>

      <InvestmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        investment={editing}
      />
      <InvestmentDetailSheet
        investmentId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(undefined)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete investment?"
        description="This will remove the holding from your tracker. This cannot be undone."
        confirmLabel="Delete"
        loading={deleteInvestment.isPending}
        onConfirm={() =>
          deleting &&
          deleteInvestment.mutate(deleting.id, {
            onSuccess: () => setDeleting(undefined),
          })
        }
      />
    </>
  );
}

function InvestmentSummary({
  investments,
  currency,
}: {
  investments: Investment[];
  currency: string;
}) {
  const totalInvested = investments.reduce(
    (sum, i) => sum + i.amountInvested,
    0,
  );
  const totalValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalGain = totalValue - totalInvested;
  const returnPct =
    totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const positive = totalGain >= 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total invested"
        value={formatCurrency(totalInvested, currency)}
        icon={Wallet}
      />
      <StatCard
        title="Current value"
        value={formatCurrency(totalValue, currency)}
        icon={LineChart}
      />
      <StatCard
        title="Total gain / loss"
        value={`${positive ? "+" : ""}${formatCurrency(totalGain, currency)}`}
        hint={`${positive ? "+" : ""}${returnPct.toFixed(2)}% overall return`}
        icon={positive ? TrendingUp : TrendingDown}
      />
    </div>
  );
}
