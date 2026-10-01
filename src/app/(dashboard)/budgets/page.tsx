"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, PiggyBank, Plus } from "lucide-react";

import { useBudgets, useDeleteBudget } from "@/hooks/use-budgets";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency } from "@/lib/format";
import {
  currentMonthKey,
  daysLeftInMonth,
  formatMonthShort,
  shiftMonth,
} from "@/lib/month";
import { cn } from "@/lib/utils";
import { OVERALL_BUDGET_ID, type BudgetStatus } from "@/types/domain";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryView } from "@/components/shared/query-view";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetFormDialog } from "@/components/forms/budget-form-dialog";
import { ProgressBar } from "@/components/budgets/progress-bar";

export default function BudgetsPage() {
  const [month, setMonth] = React.useState(() => currentMonthKey());
  const budgetsQuery = useBudgets(month);
  const deleteBudget = useDeleteBudget();
  const currency = useCurrency();
  const { categoryName } = useLookups();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BudgetStatus | undefined>();
  const [deleting, setDeleting] = React.useState<BudgetStatus | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (budget: BudgetStatus) => {
    setEditing(budget);
    setFormOpen(true);
  };

  const budgetName = (budget: BudgetStatus) =>
    budget.categoryId === OVERALL_BUDGET_ID
      ? "Overall spending"
      : categoryName(budget.categoryId);

  const isCurrentMonth = month === currentMonthKey();

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Monthly spending limits per category, or for everything."
        action={{ label: "Add budget", onClick: openCreate }}
        actions={
          <div className="flex w-full items-center justify-between gap-1 sm:w-auto">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label="Previous month"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <button
              type="button"
              className="min-h-11 min-w-28 rounded-md px-2 text-center text-sm font-semibold"
              onClick={() => setMonth(currentMonthKey())}
              aria-label="Go to this month"
            >
              {formatMonthShort(month)}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label="Next month"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        }
      />

      <QueryView
        query={budgetsQuery}
        loading={
          <div className="space-y-3">
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        }
      >
        {(budgets) =>
          budgets.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="No budgets yet"
              description="A budget is a monthly spending limit for a category (like Food) or for all your spending. You'll see how much is left and get a heads-up at 80%."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add budget
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <BudgetSummary
                budgets={budgets}
                month={month}
                currency={currency}
                isCurrentMonth={isCurrentMonth}
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {budgets.map((budget) => (
                  <BudgetCard
                    key={budget.id}
                    budget={budget}
                    name={budgetName(budget)}
                    currency={currency}
                    onClick={() => openEdit(budget)}
                  />
                ))}
              </div>
            </div>
          )
        }
      </QueryView>

      <BudgetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        budget={editing}
        budgetedCategoryIds={(budgetsQuery.data ?? []).map((b) => b.categoryId)}
        onDelete={(budget) => {
          setFormOpen(false);
          setDeleting(budget as BudgetStatus);
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete budget?"
        description="Your expenses stay as they are; only the limit is removed."
        confirmLabel="Delete"
        loading={deleteBudget.isPending}
        onConfirm={() =>
          deleting &&
          deleteBudget.mutate(deleting.id, {
            onSuccess: () => setDeleting(undefined),
          })
        }
      />
    </>
  );
}

function BudgetSummary({
  budgets,
  month,
  currency,
  isCurrentMonth,
}: {
  budgets: BudgetStatus[];
  month: string;
  currency: string;
  isCurrentMonth: boolean;
}) {
  // An overall budget is the real cap; otherwise add up the category limits.
  const overall = budgets.find((b) => b.categoryId === OVERALL_BUDGET_ID);
  const categories = budgets.filter((b) => b.categoryId !== OVERALL_BUDGET_ID);
  const budgeted = overall
    ? overall.amount
    : categories.reduce((total, b) => total + b.amount, 0);
  const spent = overall
    ? overall.spent
    : categories.reduce((total, b) => total + b.spent, 0);
  const left = budgeted - spent;
  const ratio = budgeted > 0 ? spent / budgeted : 0;
  const daysLeft = daysLeftInMonth(month);
  const perDay = daysLeft > 0 ? Math.max(0, left) / daysLeft : 0;

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {left >= 0 ? "Left to spend" : "Over budget"}
            </p>
            <p
              className={cn(
                "truncate text-2xl font-semibold tabular-nums",
                left < 0 && "text-red-600 dark:text-red-400",
              )}
            >
              {formatCurrency(Math.abs(left), currency)}
            </p>
          </div>
          <p className="shrink-0 text-right text-xs text-muted-foreground">
            {daysLeft === 0
              ? "Month ended"
              : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
          </p>
        </div>
        <ProgressBar ratio={ratio} label="Total budget used" />
        <div className="grid grid-cols-3 gap-2 text-center">
          <SummaryStat
            label="Budgeted"
            value={formatCurrency(budgeted, currency)}
          />
          <SummaryStat label="Spent" value={formatCurrency(spent, currency)} />
          <SummaryStat
            label={isCurrentMonth ? "Safe per day" : "Per day left"}
            value={daysLeft > 0 ? formatCurrency(perDay, currency) : "—"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 px-2 py-2">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function BudgetCard({
  budget,
  name,
  currency,
  onClick,
}: {
  budget: BudgetStatus;
  name: string;
  currency: string;
  onClick: () => void;
}) {
  const over = budget.remaining < 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-11 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors active:bg-muted/60 hover:bg-muted/40"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate font-medium">{name}</p>
        <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {Math.round(budget.ratio * 100)}%
        </p>
      </div>
      <ProgressBar ratio={budget.ratio} className="mt-3" label={`${name} used`} />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-muted-foreground tabular-nums">
          {formatCurrency(budget.spent, currency)} of{" "}
          {formatCurrency(budget.amount, currency)}
        </span>
        <span
          className={cn(
            "shrink-0 font-medium tabular-nums",
            over
              ? "text-red-600 dark:text-red-400"
              : budget.level === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {formatCurrency(Math.abs(budget.remaining), currency)}{" "}
          {over ? "over" : "left"}
        </span>
      </div>
    </button>
  );
}
