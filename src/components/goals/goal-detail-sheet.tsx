"use client";

import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  Minus,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";

import {
  useDeleteGoalContribution,
  useGoal,
  useUpdateGoal,
} from "@/hooks/use-goals";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Goal } from "@/types/domain";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalContributionFormDialog } from "@/components/forms/goal-contribution-form-dialog";
import {
  GoalPaceText,
  ProgressRing,
  goalRatio,
} from "@/components/goals/goal-progress";

interface GoalDetailSheetProps {
  goalId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}

const HISTORY_PAGE_SIZE = 8;

export function GoalDetailSheet({
  goalId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: GoalDetailSheetProps) {
  const goalQuery = useGoal(open ? goalId : undefined);
  const deleteContribution = useDeleteGoalContribution();
  const updateGoal = useUpdateGoal();
  const { accountName } = useLookups();
  const currency = useCurrency();
  const [contributionOpen, setContributionOpen] = React.useState(false);
  const [contributionMode, setContributionMode] = React.useState<
    "add" | "withdraw"
  >("add");
  const openContribution = (mode: "add" | "withdraw") => {
    setContributionMode(mode);
    setContributionOpen(true);
  };
  const [visibleCount, setVisibleCount] = React.useState(HISTORY_PAGE_SIZE);

  React.useEffect(() => {
    setVisibleCount(HISTORY_PAGE_SIZE);
  }, [goalId, open]);

  const goal = goalQuery.data;
  const visibleContributions =
    goal?.contributions.slice(0, visibleCount) ?? [];
  const saved = goal?.savedAmount ?? 0;
  const left = goal ? Math.max(0, goal.targetAmount - saved) : 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto border-l-0 sm:max-w-md sm:border-l">
          {goalQuery.isLoading || !goal ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="flex flex-wrap items-center gap-2 pr-6">
                  {goal.name}
                  {goal.isArchived ? (
                    <Badge variant="outline">Archived</Badge>
                  ) : null}
                </SheetTitle>
                <SheetDescription>
                  {goal.targetDate
                    ? `Target date ${formatDate(goal.targetDate)}`
                    : "No target date"}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 flex items-center gap-4 rounded-lg border p-4">
                <ProgressRing ratio={goalRatio(goal)} size={72} stroke={7} />
                <div className="min-w-0 space-y-1">
                  <p className="text-lg font-semibold tabular-nums">
                    {formatCurrency(saved, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    of {formatCurrency(goal.targetAmount, currency)} ·{" "}
                    {formatCurrency(left, currency)} to go
                  </p>
                  <GoalPaceText
                    goal={goal}
                    currency={currency}
                    className="block text-xs"
                  />
                </div>
              </div>

              {goal.accountId ? (
                <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                  <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
                  Progress follows the balance of{" "}
                  {accountName(goal.accountId)}. Move money into that account
                  to grow this goal.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    className="h-11"
                    onClick={() => openContribution("add")}
                  >
                    <Plus className="h-4 w-4" />
                    Add money
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    disabled={saved <= 0}
                    onClick={() => openContribution("withdraw")}
                  >
                    <Minus className="h-4 w-4" />
                    Withdraw
                  </Button>
                </div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  variant="ghost"
                  className="h-11"
                  onClick={() => onEdit(goal)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  className="h-11"
                  disabled={updateGoal.isPending}
                  onClick={() =>
                    updateGoal.mutate({
                      id: goal.id,
                      input: { isArchived: !goal.isArchived },
                    })
                  }
                >
                  {goal.isArchived ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  {goal.isArchived ? "Restore" : "Archive"}
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 text-destructive"
                  onClick={() => onDelete(goal)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>

              {goal.accountId ? null : (
                <>
                  <Separator className="my-4" />
                  <h3 className="text-sm font-semibold">History</h3>
                  <div className="mt-3 space-y-2">
                    {goal.contributions.length === 0 ? (
                      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                        Nothing saved yet. Tap “Add money” when you put some
                        aside.
                      </p>
                    ) : (
                      visibleContributions.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex min-h-14 items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "font-medium tabular-nums",
                                entry.amount >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600 dark:text-red-400",
                              )}
                            >
                              {entry.amount >= 0 ? "+" : "−"}
                              {formatCurrency(Math.abs(entry.amount), currency)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatDate(entry.date)}
                              {entry.notes ? ` · ${entry.notes}` : ""}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 shrink-0 text-destructive"
                            disabled={deleteContribution.isPending}
                            onClick={() => deleteContribution.mutate(entry.id)}
                            aria-label="Delete entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                    {goal.contributions.length > visibleCount ? (
                      <Button
                        variant="outline"
                        className="h-11 w-full"
                        onClick={() =>
                          setVisibleCount((count) => count + HISTORY_PAGE_SIZE)
                        }
                      >
                        Show more (
                        {goal.contributions.length - visibleCount} remaining)
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {goal ? (
        <GoalContributionFormDialog
          open={contributionOpen}
          onOpenChange={setContributionOpen}
          goalId={goal.id}
          mode={contributionMode}
        />
      ) : null}
    </>
  );
}
