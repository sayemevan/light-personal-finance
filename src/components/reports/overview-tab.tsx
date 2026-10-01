"use client";

import * as React from "react";
import { Store, TrendingUp } from "lucide-react";

import { useCalendarMonth } from "@/hooks/use-calendar-month";
import { useOverviewReport } from "@/hooks/use-reports";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  CategoryComparisonRow,
  MerchantRow,
  OverviewReport,
} from "@/types/reports";
import { QueryView } from "@/components/shared/query-view";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChangeIndicator,
  dailyPace,
  monthLabel,
} from "@/components/reports/report-utils";

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString("en-US", { month: "short" }),
);

/** How many of the largest month-over-month increases get highlighted. */
const HIGHLIGHT_INCREASES = 3;

interface OverviewTabProps {
  year: string;
  currency: string;
}

export function OverviewTab({ year, currency }: OverviewTabProps) {
  // Local month, known only on the client (null while server rendering).
  const today = useCalendarMonth();
  const isCurrentYear = today !== null && year === String(today.year);
  const lastMonth = isCurrentYear ? today.month : 12;
  const [pickedMonth, setPickedMonth] = React.useState<number | null>(null);
  const month = Math.min(pickedMonth ?? today?.month ?? 12, lastMonth);
  const overview = useOverviewReport(year, month, { enabled: today !== null });

  return (
    <div className="space-y-4 md:space-y-6">
      {today ? (
        <MonthChips
          count={lastMonth}
          value={month}
          onChange={setPickedMonth}
        />
      ) : null}
      <QueryView query={overview}>
        {(report) => <OverviewContent report={report} currency={currency} />}
      </QueryView>
    </div>
  );
}

function MonthChips({
  count,
  value,
  onChange,
}: {
  count: number;
  value: number;
  onChange: (month: number) => void;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    // Keep the selected chip centred without scrolling the page itself.
    const list = listRef.current;
    const chip = selectedRef.current;
    if (!list || !chip) return;
    list.scrollTo({
      left: chip.offsetLeft - (list.clientWidth - chip.clientWidth) / 2,
      behavior: "smooth",
    });
  }, [value]);

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label="Month"
      data-print-hide
      className="no-scrollbar relative -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
    >
      {MONTHS.slice(0, count).map((label, index) => {
        const month = index + 1;
        const selected = month === value;
        return (
          <button
            key={label}
            ref={selected ? selectedRef : undefined}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(month)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function OverviewContent({
  report,
  currency,
}: {
  report: OverviewReport;
  currency: string;
}) {
  const fmt = (value: number) => formatCurrency(value, currency);
  const pace = dailyPace(report.month, report.current.spent);
  const prevLabel = monthLabel(report.previousMonth, true);

  return (
    <>
      <p className="hidden text-sm font-medium print:block">
        {monthLabel(report.month, true)} {report.year}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        <MetricCard
          title="Spent"
          value={fmt(report.current.spent)}
          current={report.current.spent}
          previous={report.previous.spent}
          goodWhenUp={false}
          previousText={`${fmt(report.previous.spent)} in ${prevLabel}`}
        />
        <MetricCard
          title="Income"
          value={fmt(report.current.income)}
          current={report.current.income}
          previous={report.previous.income}
          goodWhenUp
          previousText={`${fmt(report.previous.income)} in ${prevLabel}`}
        />
        <MetricCard
          title="Net"
          value={fmt(report.current.net)}
          current={report.current.net}
          previous={report.previous.net}
          goodWhenUp
          previousText={`${fmt(report.previous.net)} in ${prevLabel}`}
          valueClassName={
            report.current.net < 0 ? "text-red-600 dark:text-red-400" : undefined
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">
              Avg. daily spend
            </p>
            <p className="mt-1 break-words text-lg font-semibold tracking-tight sm:text-2xl">
              {fmt(pace.average)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pace.daysCounted === 0
                ? "Month hasn't started"
                : pace.isCurrent
                  ? `Over ${pace.daysCounted} of ${pace.daysInMonth} days`
                  : `Over ${pace.daysInMonth} days`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">
              {pace.projected === null ? "Month total" : "Projected month-end"}
            </p>
            <p className="mt-1 break-words text-lg font-semibold tracking-tight sm:text-2xl">
              {fmt(pace.projected ?? report.current.spent)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pace.projected === null
                ? "Month complete"
                : "At the current daily pace"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <CategoryComparison
          rows={report.categories}
          currency={currency}
          monthText={monthLabel(report.month, true)}
          prevText={prevLabel}
        />
        <TopMerchants
          rows={report.topMerchants}
          currency={currency}
          year={report.year}
        />
      </div>
    </>
  );
}

function MetricCard({
  title,
  value,
  current,
  previous,
  goodWhenUp,
  previousText,
  valueClassName,
}: {
  title: string;
  value: string;
  current: number;
  previous: number;
  goodWhenUp: boolean;
  previousText: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4 sm:block sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">
            {title}
          </p>
          <p
            className={cn(
              "mt-1 break-words text-lg font-semibold tracking-tight sm:text-2xl",
              valueClassName,
            )}
          >
            {value}
          </p>
        </div>
        <div className="shrink-0 text-right sm:mt-1 sm:text-left">
          <ChangeIndicator
            current={current}
            previous={previous}
            goodWhenUp={goodWhenUp}
          />
          <p className="mt-0.5 text-xs text-muted-foreground">{previousText}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryComparison({
  rows,
  currency,
  monthText,
  prevText,
}: {
  rows: CategoryComparisonRow[];
  currency: string;
  monthText: string;
  prevText: string;
}) {
  const highlighted = React.useMemo(
    () =>
      new Set(
        [...rows]
          .filter((row) => row.change > 0)
          .sort((a, b) => b.change - a.change)
          .slice(0, HIGHLIGHT_INCREASES)
          .map((row) => row.categoryId),
      ),
    [rows],
  );
  const max = Math.max(1, ...rows.map((row) => Math.max(row.current, row.previous)));

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base">Categories</CardTitle>
        <CardDescription>
          {monthText} vs {prevText}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No spending in either month.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => {
              const hot = highlighted.has(row.categoryId);
              return (
                <li
                  key={row.categoryId}
                  className={cn(
                    "-mx-2 rounded-lg px-2 py-2.5",
                    hot && "bg-amber-500/10",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
                      {hot ? (
                        <TrendingUp
                          className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                          aria-label="Biggest increase"
                        />
                      ) : null}
                      <span className="truncate">{row.name}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(row.current, currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(row.current / max) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="truncate">
                      Last month {formatCurrency(row.previous, currency)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                      {row.change === 0
                        ? null
                        : `${row.change > 0 ? "+" : "−"}${formatCurrency(Math.abs(row.change), currency)}`}
                      <ChangeIndicator
                        current={row.current}
                        previous={row.previous}
                        goodWhenUp={false}
                      />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TopMerchants({
  rows,
  currency,
  year,
}: {
  rows: MerchantRow[];
  currency: string;
  year: string;
}) {
  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base">Top merchants</CardTitle>
        <CardDescription>By total spent in {year}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Store className="mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Add a merchant to your expenses to see where you spend most.
            </p>
          </div>
        ) : (
          <ol className="divide-y">
            {rows.map((row, index) => (
              <li
                key={row.name.toLowerCase()}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.count} {row.count === 1 ? "visit" : "visits"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatCurrency(row.total, currency)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
