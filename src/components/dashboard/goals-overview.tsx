"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { useGoals } from "@/hooks/use-goals";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProgressBar } from "@/components/budgets/progress-bar";
import { GoalPaceText, goalRatio } from "@/components/goals/goal-progress";

const MAX_GOALS = 3;

/** Dashboard card: up to three active savings goals. Hidden when none. */
export function GoalsOverview() {
  const goalsQuery = useGoals();
  const currency = useCurrency();

  const goals = (goalsQuery.data ?? [])
    .filter((goal) => !goal.isArchived)
    .slice(0, MAX_GOALS);
  if (goals.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Goals</CardTitle>
          <CardDescription>What you&apos;re saving for</CardDescription>
        </div>
        <Link
          href="/goals"
          className="-my-2 -mr-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary"
        >
          See all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.map((goal) => {
          const ratio = goalRatio(goal);
          return (
            <div key={goal.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{goal.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(goal.savedAmount ?? 0, currency)} of{" "}
                  {formatCurrency(goal.targetAmount, currency)}
                </span>
              </div>
              <ProgressBar
                ratio={ratio}
                toneClassName={ratio >= 1 ? "bg-emerald-500" : "bg-primary"}
                label={`${goal.name} progress`}
              />
              <GoalPaceText
                goal={goal}
                currency={currency}
                className="block text-xs"
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
