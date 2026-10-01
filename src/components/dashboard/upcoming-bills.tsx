"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight } from "lucide-react";

import { useRecurring, useSkipOccurrence } from "@/hooks/use-recurring";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  addDays,
  occurrencesDue,
  todayISO,
  upcomingOccurrences,
} from "@/lib/recurring";
import { cn } from "@/lib/utils";
import type { RecurringKind } from "@/types/domain";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ConfirmOccurrenceDialog,
  type OccurrenceToConfirm,
} from "@/components/recurring/confirm-occurrence-dialog";

const MAX_UPCOMING = 6;

const KIND_ICON: Record<RecurringKind, typeof ArrowUpRight> = {
  expense: ArrowUpRight,
  income: ArrowDownLeft,
  transfer: ArrowLeftRight,
};

const KIND_TONE: Record<RecurringKind, string> = {
  expense: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  income: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  transfer: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

function relativeDay(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date < today) return `Due ${formatDate(date)}`;
  return formatDate(date);
}

function KindIcon({ kind }: { kind: RecurringKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        KIND_TONE[kind],
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

/**
 * Dashboard card: recurring occurrences waiting for confirmation (with inline
 * Add / Skip), then what's coming up in the next 7 days. Renders nothing for
 * users without recurring rules.
 */
export function UpcomingBills() {
  const { data: rules } = useRecurring();
  const currency = useCurrency();
  const skip = useSkipOccurrence();
  const [confirming, setConfirming] = React.useState<
    OccurrenceToConfirm | undefined
  >();

  const today = todayISO();

  const { pending, upcoming } = React.useMemo(() => {
    const all = rules ?? [];
    const pendingList: OccurrenceToConfirm[] = [];
    for (const rule of all) {
      if (rule.autoPost) continue;
      const [date] = occurrencesDue(rule, today, 1);
      if (date) {
        pendingList.push({
          ruleId: rule.id,
          name: rule.name,
          kind: rule.kind,
          amount: rule.amount,
          date,
        });
      }
    }
    pendingList.sort((a, b) => a.date.localeCompare(b.date));
    return {
      pending: pendingList,
      upcoming: upcomingOccurrences(all, addDays(today, 1), 6).slice(
        0,
        MAX_UPCOMING,
      ),
    };
  }, [rules, today]);

  if (!rules || rules.length === 0) return null;

  const amountText = (kind: RecurringKind, amount: number) =>
    `${kind === "income" ? "+" : ""}${formatCurrency(amount, currency)}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Upcoming bills</CardTitle>
          <CardDescription>
            {pending.length > 0
              ? `${pending.length} waiting for you to confirm`
              : "Recurring transactions in the next 7 days"}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="-mr-2 shrink-0">
          <Link href="/recurring">
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending.length > 0 ? (
          <ul className="divide-y rounded-xl border border-amber-500/30 bg-amber-500/5">
            {pending.map((item) => (
              <li
                key={item.ruleId}
                className="flex flex-wrap items-center gap-3 px-3 py-3"
              >
                <KindIcon kind={item.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {relativeDay(item.date, today)} ·{" "}
                    {amountText(item.kind, item.amount)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    disabled={skip.isPending}
                    onClick={() => skip.mutate({ id: item.ruleId, date: item.date })}
                  >
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    className="h-9"
                    onClick={() => setConfirming(item)}
                  >
                    Add
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {upcoming.length > 0 ? (
          <ul className="space-y-3">
            {upcoming.map(({ rule, date }) => (
              <li key={`${rule.id}-${date}`} className="flex items-center gap-3">
                <KindIcon kind={rule.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {relativeDay(date, today)}
                    {rule.autoPost ? " · Auto" : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-medium",
                    rule.kind === "income" &&
                      "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {amountText(rule.kind, rule.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing due in the next 7 days.
          </p>
        ) : null}
      </CardContent>

      <ConfirmOccurrenceDialog
        occurrence={confirming}
        onOpenChange={(open) => !open && setConfirming(undefined)}
      />
    </Card>
  );
}
