"use client";

import * as React from "react";
import {
  CalendarClock,
  CirclePause,
  CirclePlay,
  Plus,
  Repeat,
  SkipForward,
} from "lucide-react";

import {
  useDeleteRecurring,
  useRecurring,
  useSkipOccurrence,
  useToggleRecurring,
} from "@/hooks/use-recurring";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  describeSchedule,
  monthlyCommitments,
  todayISO,
  withinEnd,
} from "@/lib/recurring";
import { cn } from "@/lib/utils";
import type { RecurringKind, RecurringRule } from "@/types/domain";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryView } from "@/components/shared/query-view";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RowActions } from "@/components/shared/row-actions";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RecurringFormDialog } from "@/components/forms/recurring-form-dialog";
import {
  ConfirmOccurrenceDialog,
  type OccurrenceToConfirm,
} from "@/components/recurring/confirm-occurrence-dialog";

type KindFilter = "all" | RecurringKind;

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfers" },
];

const EXAMPLES = [
  "Rent on the 1st",
  "Salary on the 25th",
  "Netflix every month",
  "DPS savings transfer",
];

const AMOUNT_CLASS: Record<RecurringKind, string> = {
  expense: "",
  income: "text-emerald-600 dark:text-emerald-400",
  transfer: "text-muted-foreground",
};

function isDue(rule: RecurringRule, today: string) {
  return rule.isActive && rule.nextDate <= today && withinEnd(rule, rule.nextDate);
}

export default function RecurringPage() {
  const rulesQuery = useRecurring();
  const currency = useCurrency();
  const { accountName, categoryName } = useLookups();
  const deleteRule = useDeleteRecurring();
  const toggleRule = useToggleRecurring();
  const skip = useSkipOccurrence();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RecurringRule | undefined>();
  const [deleting, setDeleting] = React.useState<RecurringRule | undefined>();
  const [confirming, setConfirming] = React.useState<
    OccurrenceToConfirm | undefined
  >();
  const [filter, setFilter] = React.useState<KindFilter>("all");

  const today = todayISO();

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = React.useCallback((rule: RecurringRule) => {
    setEditing(rule);
    setFormOpen(true);
  }, []);

  const columns: DataTableColumn<RecurringRule>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (row) => (
          <span
            className={cn("font-medium", !row.isActive && "text-muted-foreground")}
          >
            {row.name}
          </span>
        ),
        sortValue: (row) => row.name,
        searchValue: (row) => `${row.name} ${row.notes ?? ""}`,
      },
      {
        id: "schedule",
        mobile: "subtitle",
        header: "Schedule",
        cell: (row) => describeSchedule(row),
        sortValue: (row) => row.frequency,
      },
      {
        id: "details",
        mobile: "hidden",
        header: "Category / account",
        cell: (row) =>
          row.kind === "transfer"
            ? `${accountName(row.accountId)} → ${
                row.toAccountId ? accountName(row.toAccountId) : "—"
              }`
            : `${row.categoryId ? categoryName(row.categoryId) : "—"} · ${accountName(
                row.accountId,
              )}`,
        searchValue: (row) =>
          `${accountName(row.accountId)} ${
            row.toAccountId ? accountName(row.toAccountId) : ""
          } ${row.categoryId ? categoryName(row.categoryId) : ""}`,
      },
      {
        id: "status",
        mobile: "meta",
        header: "Mode",
        cell: (row) =>
          !row.isActive ? (
            <Badge variant="outline">Paused</Badge>
          ) : isDue(row, today) && !row.autoPost ? (
            <Badge variant="warning">Needs confirming</Badge>
          ) : row.autoPost ? (
            <Badge variant="secondary">Auto</Badge>
          ) : (
            <Badge variant="outline">Confirm</Badge>
          ),
        sortValue: (row) => (row.isActive ? (row.autoPost ? 0 : 1) : 2),
      },
      {
        id: "amount",
        mobile: "trailing",
        header: "Amount",
        align: "right",
        cell: (row) => (
          <span className={cn("font-medium", AMOUNT_CLASS[row.kind])}>
            {row.kind === "income" ? "+" : ""}
            {formatCurrency(row.amount, currency)}
          </span>
        ),
        sortValue: (row) => row.amount,
      },
      {
        id: "next",
        mobile: "trailingSub",
        header: "Next",
        align: "right",
        cell: (row) =>
          !row.isActive ? (
            "—"
          ) : isDue(row, today) ? (
            <span className="text-amber-600 dark:text-amber-400">
              Due {formatDate(row.nextDate)}
            </span>
          ) : (
            formatDate(row.nextDate)
          ),
        sortValue: (row) => (row.isActive ? row.nextDate : "9999"),
      },
      {
        id: "actions",
        header: "",
        align: "right",
        cell: (row) => (
          <RowActions onEdit={() => openEdit(row)} onDelete={() => setDeleting(row)}>
            {row.isActive ? (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    setConfirming({
                      ruleId: row.id,
                      name: row.name,
                      kind: row.kind,
                      amount: row.amount,
                      date: row.nextDate,
                    })
                  }
                >
                  <CalendarClock className="h-4 w-4" />
                  Post now
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => skip.mutate({ id: row.id, date: row.nextDate })}
                >
                  <SkipForward className="h-4 w-4" />
                  Skip next
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem
              onClick={() =>
                toggleRule.mutate({ id: row.id, isActive: !row.isActive })
              }
            >
              {row.isActive ? (
                <CirclePause className="h-4 w-4" />
              ) : (
                <CirclePlay className="h-4 w-4" />
              )}
              {row.isActive ? "Pause" : "Resume"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </RowActions>
        ),
      },
    ],
    // `skip` / `toggleRule` mutate functions are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currency, accountName, categoryName, today, openEdit],
  );

  return (
    <>
      <PageHeader
        title="Recurring"
        description="Rent, salary, subscriptions, EMIs and automatic savings transfers."
        action={{ label: "Add recurring", onClick: openCreate }}
      />

      <QueryView query={rulesQuery}>
        {(rules) => {
          if (rules.length === 0) {
            return (
              <EmptyState
                icon={Repeat}
                title="No recurring transactions"
                description="Set up things that repeat and they'll be added on schedule — or wait for you to confirm."
                action={
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex flex-wrap justify-center gap-2">
                      {EXAMPLES.map((example) => (
                        <span
                          key={example}
                          className="rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
                        >
                          {example}
                        </span>
                      ))}
                    </div>
                    <Button onClick={openCreate}>
                      <Plus className="h-4 w-4" />
                      Add recurring
                    </Button>
                  </div>
                }
              />
            );
          }

          const totals = monthlyCommitments(rules);
          const counts = rules.reduce<Record<KindFilter, number>>(
            (acc, rule) => {
              acc[rule.kind] += 1;
              acc.all += 1;
              return acc;
            },
            { all: 0, expense: 0, income: 0, transfer: 0 },
          );
          const visible =
            filter === "all" ? rules : rules.filter((r) => r.kind === filter);

          return (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs font-medium text-muted-foreground sm:text-sm">
                    Monthly commitments
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-tight sm:text-2xl">
                    {formatCurrency(totals.expense, currency)} out
                    <span className="text-muted-foreground">, </span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(totals.income, currency)} in
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {totals.transfer > 0
                      ? `Plus ${formatCurrency(totals.transfer, currency)} moved between accounts. `
                      : ""}
                    Averaged per month across active schedules.
                  </p>
                </CardContent>
              </Card>

              <div
                role="tablist"
                aria-label="Filter by type"
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
              >
                {FILTERS.map((option) => {
                  const active = option.value === filter;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(option.value)}
                      className={cn(
                        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors active:scale-95",
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {option.label}
                      <span
                        className={cn(
                          "text-xs",
                          active ? "opacity-80" : "opacity-60",
                        )}
                      >
                        {counts[option.value]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <DataTable
                data={visible}
                columns={columns}
                getRowId={(row) => row.id}
                searchPlaceholder="Search recurring…"
                onRowClick={openEdit}
              />
            </div>
          );
        }}
      </QueryView>

      <RecurringFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        rule={editing}
      />
      <ConfirmOccurrenceDialog
        occurrence={confirming}
        onOpenChange={(open) => !open && setConfirming(undefined)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete recurring transaction?"
        description="Transactions it already added are kept. This cannot be undone."
        confirmLabel="Delete"
        loading={deleteRule.isPending}
        onConfirm={() =>
          deleting &&
          deleteRule.mutate(deleting.id, {
            onSuccess: () => setDeleting(undefined),
          })
        }
      />
    </>
  );
}
