"use client";

import * as React from "react";
import { Plus, Target, Wallet } from "lucide-react";

import { useDeleteGoal, useGoals } from "@/hooks/use-goals";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Goal } from "@/types/domain";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryView } from "@/components/shared/query-view";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalFormDialog } from "@/components/forms/goal-form-dialog";
import { GoalDetailSheet } from "@/components/goals/goal-detail-sheet";
import {
  GoalPaceText,
  ProgressRing,
  goalRatio,
} from "@/components/goals/goal-progress";

export default function GoalsPage() {
  const goalsQuery = useGoals();
  const deleteGoal = useDeleteGoal();
  const currency = useCurrency();
  const { accountName } = useLookups();

  const [showArchived, setShowArchived] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Goal | undefined>();
  const [deleting, setDeleting] = React.useState<Goal | undefined>();
  const [detailId, setDetailId] = React.useState<string | undefined>();
  const [detailOpen, setDetailOpen] = React.useState(false);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setFormOpen(true);
  };
  const openDetail = (goal: Goal) => {
    setDetailId(goal.id);
    setDetailOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Goals"
        description="Save towards the things that matter, one step at a time."
        action={{ label: "Add goal", onClick: openCreate }}
      />

      <QueryView
        query={goalsQuery}
        loading={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        }
      >
        {(goals) => {
          const archivedCount = goals.filter((g) => g.isArchived).length;
          const visible = goals.filter((g) => showArchived || !g.isArchived);
          return goals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No goals yet"
              description="Set a target — an emergency fund, a trip, a new laptop — and track how close you are. Add money as you save, or follow a savings account's balance."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add goal
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {visible.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  All your goals are archived.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {visible.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      currency={currency}
                      accountLabel={
                        goal.accountId ? accountName(goal.accountId) : undefined
                      }
                      onClick={() => openDetail(goal)}
                    />
                  ))}
                </div>
              )}
              {archivedCount > 0 ? (
                <Button
                  variant="ghost"
                  className="h-11 w-full text-muted-foreground"
                  onClick={() => setShowArchived((value) => !value)}
                >
                  {showArchived
                    ? "Hide archived"
                    : `Show archived (${archivedCount})`}
                </Button>
              ) : null}
            </div>
          );
        }}
      </QueryView>

      <GoalDetailSheet
        goalId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onDelete={setDeleting}
      />
      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete goal?"
        description="The goal and its saved-money history will be removed. Your accounts are not affected. This cannot be undone."
        confirmLabel="Delete"
        loading={deleteGoal.isPending}
        onConfirm={() =>
          deleting &&
          deleteGoal.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(undefined);
              setDetailOpen(false);
            },
          })
        }
      />
    </>
  );
}

function GoalCard({
  goal,
  currency,
  accountLabel,
  onClick,
}: {
  goal: Goal;
  currency: string;
  accountLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-w-0 items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40 active:bg-muted/60"
    >
      <ProgressRing ratio={goalRatio(goal)} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{goal.name}</p>
          {goal.isArchived ? (
            <Badge variant="outline" className="shrink-0">
              Archived
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-sm tabular-nums">
          {formatCurrency(goal.savedAmount ?? 0, currency)}{" "}
          <span className="text-muted-foreground">
            of {formatCurrency(goal.targetAmount, currency)}
          </span>
        </p>
        <p className="truncate text-xs">
          {goal.targetDate ? (
            <span className="text-muted-foreground">
              By {formatDate(goal.targetDate)} ·{" "}
            </span>
          ) : null}
          <GoalPaceText goal={goal} currency={currency} />
        </p>
        {accountLabel ? (
          <Badge variant="secondary" className="max-w-full gap-1">
            <Wallet className="h-3 w-3 shrink-0" />
            <span className="truncate">{accountLabel}</span>
          </Badge>
        ) : null}
      </div>
    </button>
  );
}
