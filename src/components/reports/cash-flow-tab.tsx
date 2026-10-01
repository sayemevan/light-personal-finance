"use client";

import * as React from "react";
import { Waves } from "lucide-react";

import { useCashFlowReport } from "@/hooks/use-reports";
import { formatCurrency } from "@/lib/format";
import type { CashFlowReport } from "@/types/reports";
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
  CashFlowSankey,
  FLOW_COLORS,
} from "@/components/charts/cash-flow-sankey";
import {
  SERIES_COLORS,
  useElementWidth,
} from "@/components/reports/report-utils";

/** Below this width the Sankey labels collide; show a stacked bar instead. */
const SANKEY_MIN_WIDTH = 480;

export function CashFlowTab({
  year,
  currency,
}: {
  year: string;
  currency: string;
}) {
  const report = useCashFlowReport(year);
  return (
    <QueryView query={report}>
      {(data) =>
        data.totalIncome === 0 && data.totalExpense === 0 ? (
          <EmptyState
            icon={Waves}
            title="No cash flow yet"
            description={`Record income and expenses dated ${data.year} to see where your money goes.`}
          />
        ) : (
          <CashFlowContent report={data} currency={currency} />
        )
      }
    </QueryView>
  );
}

function CashFlowContent({
  report,
  currency,
}: {
  report: CashFlowReport;
  currency: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const fmt = (value: number) => formatCurrency(value, currency);
  const savingsRate =
    report.totalIncome > 0 ? (report.saved / report.totalIncome) * 100 : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
        <Summary label="Income" value={fmt(report.totalIncome)} />
        <Summary label="Spent" value={fmt(report.totalExpense)} />
        {report.fromSavings > 0 ? (
          <Summary
            label="From savings"
            value={fmt(report.fromSavings)}
            hint="Spent more than earned"
            className="col-span-2 sm:col-span-1"
            tone="warn"
          />
        ) : (
          <Summary
            label="Saved"
            value={fmt(report.saved)}
            hint={`${savingsRate.toFixed(1)}% of income`}
            className="col-span-2 sm:col-span-1"
            tone="good"
          />
        )}
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base">Where money goes</CardTitle>
          <CardDescription>
            Income sources to spending in {report.year}. Transfers between your
            accounts are excluded.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div ref={ref} className="w-full overflow-hidden">
            {width === 0 ? (
              <div className="h-[280px]" />
            ) : width >= SANKEY_MIN_WIDTH ? (
              <CashFlowSankey
                report={report}
                width={width}
                currency={currency}
                expenseColors={SERIES_COLORS}
              />
            ) : (
              <FlowBars report={report} currency={currency} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
  className,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
  tone?: "good" | "warn";
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-6">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">
          {label}
        </p>
        <p
          className={
            "mt-1 break-words text-lg font-semibold tracking-tight sm:text-2xl " +
            (tone === "good"
              ? "text-emerald-600 dark:text-emerald-400"
              : tone === "warn"
                ? "text-amber-600 dark:text-amber-400"
                : "")
          }
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface Segment {
  name: string;
  total: number;
  color: string;
}

/** Phone fallback: one stacked bar per side plus a legend list. */
function FlowBars({
  report,
  currency,
}: {
  report: CashFlowReport;
  currency: string;
}) {
  const outflow: Segment[] = report.expense.map((item, index) => ({
    ...item,
    color: SERIES_COLORS[index % SERIES_COLORS.length] ?? "hsl(240 5% 60%)",
  }));
  if (report.saved > 0) {
    outflow.push({ name: "Saved", total: report.saved, color: FLOW_COLORS.saved });
  }
  const inflow: Segment[] = report.income.map((item, index) => ({
    ...item,
    color: `hsl(142 71% ${35 + ((index * 9) % 30)}%)`,
  }));
  if (report.fromSavings > 0) {
    inflow.push({
      name: "From savings",
      total: report.fromSavings,
      color: FLOW_COLORS.fromSavings,
    });
  }

  return (
    <div className="space-y-6">
      <FlowGroup title="Money in" segments={inflow} currency={currency} />
      <FlowGroup title="Money out" segments={outflow} currency={currency} />
    </div>
  );
}

function FlowGroup({
  title,
  segments,
  currency,
}: {
  title: string;
  segments: Segment[];
  currency: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.total, 0);
  if (total === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <h3 className="font-medium">{title}</h3>
        <span className="font-semibold tabular-nums">
          {formatCurrency(total, currency)}
        </span>
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${title} breakdown`}
      >
        {segments.map((segment, index) => (
          <div
            key={`${segment.name}-${index}`}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(segment.total / total) * 100}%`,
              background: segment.color,
            }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {segments.map((segment, index) => (
          <li
            key={`${segment.name}-${index}`}
            className="flex items-center gap-2 text-sm"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: segment.color }}
            />
            <span className="min-w-0 flex-1 truncate">{segment.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {((segment.total / total) * 100).toFixed(0)}%
            </span>
            <span className="shrink-0 text-right tabular-nums">
              {formatCurrency(segment.total, currency)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
