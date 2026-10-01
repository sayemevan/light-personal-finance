"use client";

import * as React from "react";
import {
  Boxes,
  HandCoins,
  Plus,
  TrendingDown,
  TrendingUp,
  Undo2,
  Wallet,
} from "lucide-react";

import {
  useAssets,
  useDeleteAsset,
  useUndoAssetSale,
} from "@/hooks/use-assets";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import { summarizeAssets } from "@/lib/finance";
import { addDays, todayISO } from "@/lib/recurring";
import { ASSET_CATEGORY_LABELS, ASSET_CATEGORY_OPTIONS } from "@/lib/labels";
import type { Asset, AssetStatus } from "@/types/domain";
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
import { AssetFormDialog } from "@/components/forms/asset-form-dialog";
import { AssetSellDialog } from "@/components/forms/asset-sell-dialog";

const STATUS_OPTIONS: { label: string; value: AssetStatus }[] = [
  { label: "Owned", value: "owned" },
  { label: "Sold", value: "sold" },
];

/** Estimates older than this are flagged as due for a refresh. */
const STALE_VALUATION_DAYS = 365;

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function AssetsPage() {
  const assetsQuery = useAssets();
  const { accountName } = useLookups();
  const currency = useCurrency();
  const deleteAsset = useDeleteAsset();
  const { mutate: undoSale } = useUndoAssetSale();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Asset | undefined>();
  const [deleting, setDeleting] = React.useState<Asset | undefined>();
  const [selling, setSelling] = React.useState<Asset | undefined>();
  const [categoryFilter, setCategoryFilter] = React.useState(ALL_VALUE);
  const [statusFilter, setStatusFilter] = React.useState<string>("owned");
  const staleBefore = addDays(todayISO(), -STALE_VALUATION_DAYS);

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
        cell: (row) => (
          <span className="inline-flex items-center gap-2">
            <span className="font-medium">{row.name}</span>
            {row.status === "sold" ? <Badge variant="outline">Sold</Badge> : null}
          </span>
        ),
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
        header: "Value",
        align: "right",
        cell: (row) => {
          const value =
            row.status === "sold" ? (row.saleValue ?? 0) : row.currentValue;
          return (
            <span className="font-medium">{formatCurrency(value, currency)}</span>
          );
        },
        sortValue: (row) =>
          row.status === "sold" ? (row.saleValue ?? 0) : row.currentValue,
      },
      {
        id: "valued",
        mobile: "hidden",
        header: "Valued",
        cell: (row) => {
          if (row.status === "sold") {
            return row.saleDate ? `Sold ${formatDate(row.saleDate)}` : "Sold";
          }
          if (!row.valuedAt) {
            return <span className="text-muted-foreground">—</span>;
          }
          const stale = row.valuedAt < staleBefore;
          return (
            <span
              className={cn(stale && "text-amber-600 dark:text-amber-400")}
              title={stale ? "Over a year old. Update the estimate." : undefined}
            >
              {formatDate(row.valuedAt)}
            </span>
          );
        },
        sortValue: (row) =>
          (row.status === "sold" ? row.saleDate : row.valuedAt) ?? "",
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
          >
            {row.status === "sold" ? (
              <DropdownMenuItem onClick={() => undoSale(row.id)}>
                <Undo2 className="h-4 w-4" />
                Undo sale
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setSelling(row)}>
                <HandCoins className="h-4 w-4" />
                Mark as sold
              </DropdownMenuItem>
            )}
          </RowActions>
        ),
      },
    ],
    [currency, accountName, staleBefore, undoSale],
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
            (() => {
              const visible = assets.filter(
                (asset) =>
                  (categoryFilter === ALL_VALUE ||
                    asset.category === categoryFilter) &&
                  (statusFilter === ALL_VALUE || asset.status === statusFilter),
              );
              return (
                <div className="space-y-6">
                  <AssetSummary
                    assets={visible}
                    status={statusFilter}
                    currency={currency}
                  />
                  <DataTable
                    data={visible}
                    columns={columns}
                    getRowId={(row) => row.id}
                    searchPlaceholder="Search assets…"
                    onRowClick={openEdit}
                    toolbar={
                      <>
                        <FilterSelect
                          value={statusFilter}
                          onChange={setStatusFilter}
                          options={STATUS_OPTIONS}
                          allLabel="Owned & sold"
                        />
                        <FilterSelect
                          value={categoryFilter}
                          onChange={setCategoryFilter}
                          options={ASSET_CATEGORY_OPTIONS}
                          allLabel="All categories"
                        />
                      </>
                    }
                  />
                </div>
              );
            })()
          )
        }
      </QueryView>

      <AssetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={editing}
      />
      <AssetSellDialog
        open={Boolean(selling)}
        onOpenChange={(open) => !open && setSelling(undefined)}
        asset={selling}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete asset?"
        description={deleting ? deleteWarning(deleting, accountName) : undefined}
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

/** Spell out how deleting changes account balances, and point to "sold". */
function deleteWarning(
  asset: Asset,
  accountName: (id: string) => string,
): string {
  const effects: string[] = [];
  if (asset.accountId) {
    effects.push(
      `the purchase is no longer deducted from ${accountName(asset.accountId)}, so its balance goes up`,
    );
  }
  if (asset.status === "sold" && asset.saleAccountId) {
    effects.push(
      `the sale proceeds are removed from ${accountName(asset.saleAccountId)}`,
    );
  }
  const balance =
    effects.length > 0 ? ` Its account balances change too: ${effects.join("; ")}.` : "";
  const sell =
    asset.status === "sold" ? "" : ' If you sold it, use "Mark as sold" instead.';
  return `This removes ${asset.name} from your tracker.${balance}${sell} This cannot be undone.`;
}

function AssetSummary({
  assets,
  status,
  currency,
}: {
  assets: Asset[];
  status: string;
  currency: string;
}) {
  const { totalPurchase, totalValue, totalGain, returnPct } =
    summarizeAssets(assets);
  const positive = totalGain >= 0;
  const valueTitle =
    status === "owned"
      ? "Current value"
      : status === "sold"
        ? "Sale proceeds"
        : "Current value + proceeds";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total purchase value"
        value={formatCurrency(totalPurchase, currency)}
        icon={Wallet}
      />
      <StatCard
        title={valueTitle}
        value={formatCurrency(totalValue, currency)}
        icon={Boxes}
      />
      <StatCard
        title={status === "sold" ? "Realized gain" : "Total change"}
        value={`${positive ? "+" : ""}${formatCurrency(totalGain, currency)}`}
        hint={`${positive ? "+" : ""}${returnPct.toFixed(2)}% vs purchase`}
        icon={positive ? TrendingUp : TrendingDown}
      />
    </div>
  );
}
