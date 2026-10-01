"use client";

import Link from "next/link";
import { ChevronRight, PiggyBank } from "lucide-react";

import { useBudgets } from "@/hooks/use-budgets";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency } from "@/lib/format";
import { currentMonthKey } from "@/lib/month";
import { cn } from "@/lib/utils";
import { OVERALL_BUDGET_ID, type BudgetStatus } from "@/types/domain";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressBar } from "@/components/budgets/progress-bar";

const MAX_CATEGORIES = 4;

/** Dashboard card: this month's overall budget plus the most-used ones. */
export function BudgetOverview() {
  const budgetsQuery = useBudgets(currentMonthKey());
  const currency = useCurrency();
  const { categoryName } = useLookups();

  if (budgetsQuery.isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }
  // Errors stay quiet here; the budgets page shows them in full.
  if (budgetsQuery.isError) return null;

  const budgets = budgetsQuery.data ?? [];
  if (budgets.length === 0) {
    return (
      <Link
        href="/budgets"
        className="flex min-h-14 items-center gap-3 rounded-xl border border-dashed p-4 transition-colors hover:bg-muted/40 active:bg-muted/60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <PiggyBank className="h-5 w-5 text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            Set a monthly budget
          </span>
          <span className="block text-xs text-muted-foreground">
            Know how much is left to spend this month.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  const overall = budgets.find((b) => b.categoryId === OVERALL_BUDGET_ID);
  const categories = budgets
    .filter((b) => b.categoryId !== OVERALL_BUDGET_ID)
    .slice(0, MAX_CATEGORIES);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Budgets</CardTitle>
          <CardDescription>This month&apos;s spending limits</CardDescription>
        </div>
        <Link
          href="/budgets"
          className="-my-2 -mr-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary"
        >
          See all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {overall ? (
          <div className="rounded-lg bg-muted/50 p-3">
            <BudgetRow
              budget={overall}
              name="Overall spending"
              currency={currency}
              emphasis
            />
          </div>
        ) : null}
        {categories.map((budget) => (
          <BudgetRow
            key={budget.id}
            budget={budget}
            name={categoryName(budget.categoryId)}
            currency={currency}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function BudgetRow({
  budget,
  name,
  currency,
  emphasis,
}: {
  budget: BudgetStatus;
  name: string;
  currency: string;
  emphasis?: boolean;
}) {
  const over = budget.remaining < 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className={cn("truncate", emphasis && "font-semibold")}>
          {name}
        </span>
        <span
          className={cn(
            "shrink-0 text-xs font-medium tabular-nums",
            over
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground",
          )}
        >
          {formatCurrency(Math.abs(budget.remaining), currency)}{" "}
          {over ? "over" : "left"}
        </span>
      </div>
      <ProgressBar ratio={budget.ratio} label={`${name} used`} />
    </div>
  );
}
