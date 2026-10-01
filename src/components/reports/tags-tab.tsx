"use client";

import * as React from "react";
import { ChevronRight, Hash } from "lucide-react";

import { useTagReport } from "@/hooks/use-reports";
import { formatCurrency, formatDate } from "@/lib/format";
import type { TagReport, TagSummaryRow } from "@/types/reports";
import { QueryView } from "@/components/shared/query-view";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsPhone } from "@/components/reports/report-utils";

type TagKind = "expense" | "income";

export function TagsTab({ year, currency }: { year: string; currency: string }) {
  const report = useTagReport(year);
  return (
    <QueryView query={report}>
      {(data) =>
        data.expense.length === 0 && data.income.length === 0 ? (
          <EmptyState
            icon={Hash}
            title="No tags yet"
            description={`Add tags such as "#trip-coxsbazar" or "#wedding" to expenses and income dated ${data.year}, then see what each trip, project or event cost in total here.`}
          />
        ) : (
          <TagsContent report={data} currency={currency} />
        )
      }
    </QueryView>
  );
}

function TagsContent({
  report,
  currency,
}: {
  report: TagReport;
  currency: string;
}) {
  const [selected, setSelected] = React.useState<{
    kind: TagKind;
    row: TagSummaryRow;
  } | null>(null);
  const phone = useIsPhone();

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <TagList
          title="Expense tags"
          rows={report.expense}
          kind="expense"
          currency={currency}
          year={report.year}
          onSelect={setSelected}
        />
        <TagList
          title="Income tags"
          rows={report.income}
          kind="income"
          currency={currency}
          year={report.year}
          onSelect={setSelected}
        />
      </div>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => (open ? null : setSelected(null))}
      >
        <SheetContent
          side={phone ? "bottom" : "right"}
          className="flex flex-col gap-4 sm:max-w-md"
        >
          {selected ? (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>#{selected.row.tag}</SheetTitle>
                <SheetDescription>
                  {selected.row.count}{" "}
                  {selected.kind === "expense" ? "expense" : "income"}{" "}
                  {selected.row.count === 1 ? "entry" : "entries"} ·{" "}
                  {formatCurrency(selected.row.total, currency)}
                </SheetDescription>
              </SheetHeader>
              <ul className="-mx-1 min-h-0 flex-1 divide-y overflow-y-auto px-1">
                {selected.row.transactions.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {tx.categoryName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(tx.date)}
                        {tx.description ? ` · ${tx.description}` : ""}
                      </p>
                    </div>
                    <span
                      className={
                        "shrink-0 text-sm font-semibold tabular-nums " +
                        (selected.kind === "income"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "")
                      }
                    >
                      {formatCurrency(tx.amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function TagList({
  title,
  rows,
  kind,
  currency,
  year,
  onSelect,
}: {
  title: string;
  rows: TagSummaryRow[];
  kind: TagKind;
  currency: string;
  year: string;
  onSelect: (selection: { kind: TagKind; row: TagSummaryRow }) => void;
}) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {rows.length === 0
            ? `No ${kind} tags in ${year}`
            : `${rows.length} ${rows.length === 1 ? "tag" : "tags"} in ${year} · tap one to see its entries`}
        </CardDescription>
      </CardHeader>
      {rows.length > 0 ? (
        <CardContent className="p-2 pt-0 sm:p-4 sm:pt-0">
          <ul>
            {rows.map((row) => (
              <li key={row.tag}>
                <button
                  type="button"
                  data-print-keep
                  onClick={() => onSelect({ kind, row })}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-accent active:bg-accent"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {row.tag}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatCurrency(row.total, currency)}
                      </span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className={
                            "block h-full rounded-full " +
                            (kind === "income" ? "bg-emerald-500" : "bg-primary")
                          }
                          style={{ width: `${(row.total / max) * 100}%` }}
                        />
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {row.count} {row.count === 1 ? "entry" : "entries"}
                      </span>
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    data-print-hide
                  />
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}
