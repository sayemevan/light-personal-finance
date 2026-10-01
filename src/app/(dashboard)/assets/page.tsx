"use client";

import * as React from "react";
import { Boxes, Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { useAssets, useDeleteAsset } from "@/hooks/use-assets";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import { ASSET_CATEGORY_LABELS, ASSET_CATEGORY_OPTIONS } from "@/lib/labels";
import type { Asset } from "@/types/domain";
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
import { AssetFormDialog } from "@/components/forms/asset-form-dialog";

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function AssetsPage() {
  const assetsQuery = useAssets();
  const { accountName } = useLookups();
  const currency = useCurrency();
  const deleteAsset = useDeleteAsset();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Asset | undefined>();
  const [deleting, setDeleting] = React.useState<Asset | undefined>();
  const [categoryFilter, setCategoryFilter] = React.useState(ALL_VALUE);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (asset: Asset) => {
    setEditing(asset);
    setFormOpen(true);
  };

  const columns: DataTableColumn<Asset>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (row) => <span className="font-medium">{row.name}</span>,
        sortValue: (row) => row.name,
        searchValue: (row) => row.name,
      },
      {
        id: "category",
        mobile: "meta",
        header: "Category",
        cell: (row) => (
          <Badge variant="secondary">
            {ASSET_CATEGORY_LABELS[row.category]}
          </Badge>
        ),
        sortValue: (row) => row.category,
      },
      {
        id: "purchase",
        mobile: "hidden",
        header: "Purchase value",
        align: "right",
        cell: (row) => formatCurrency(row.purchaseValue, currency),
        sortValue: (row) => row.purchaseValue,
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
        header: "Change",
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
          />
        ),
      },
    ],
    [currency, accountName],
  );

  return (
    <>
      <PageHeader
        title="Assets"
        description="Track your personal assets and their estimated worth."
        action={{ label: "Add asset", onClick: openCreate }}
      />

      <QueryView query={assetsQuery}>
        {(assets) =>
          assets.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No assets yet"
              description="Add property, vehicles, jewelry and other belongings to track your net worth."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add asset
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              <AssetSummary assets={assets} currency={currency} />
              <DataTable
                data={assets.filter(
                  (asset) =>
                    categoryFilter === ALL_VALUE ||
                    asset.category === categoryFilter,
                )}
                columns={columns}
                getRowId={(row) => row.id}
                searchPlaceholder="Search assets…"
                onRowClick={openEdit}
                toolbar={
                  <FilterSelect
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={ASSET_CATEGORY_OPTIONS}
                    allLabel="All categories"
                  />
                }
              />
            </div>
          )
        }
      </QueryView>

      <AssetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete asset?"
        description="This will remove the asset from your tracker. This cannot be undone."
        confirmLabel="Delete"
        loading={deleteAsset.isPending}
        onConfirm={() =>
          deleting &&
          deleteAsset.mutate(deleting.id, {
            onSuccess: () => setDeleting(undefined),
          })
        }
      />
    </>
  );
}

function AssetSummary({
  assets,
  currency,
}: {
  assets: Asset[];
  currency: string;
}) {
  const totalPurchase = assets.reduce((sum, a) => sum + a.purchaseValue, 0);
  const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalGain = totalValue - totalPurchase;
  const returnPct = totalPurchase > 0 ? (totalGain / totalPurchase) * 100 : 0;
  const positive = totalGain >= 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total purchase value"
        value={formatCurrency(totalPurchase, currency)}
        icon={Wallet}
      />
      <StatCard
        title="Current value"
        value={formatCurrency(totalValue, currency)}
        icon={Boxes}
      />
      <StatCard
        title="Total change"
        value={`${positive ? "+" : ""}${formatCurrency(totalGain, currency)}`}
        hint={`${positive ? "+" : ""}${returnPct.toFixed(2)}% vs purchase`}
        icon={positive ? TrendingUp : TrendingDown}
      />
    </div>
  );
}
