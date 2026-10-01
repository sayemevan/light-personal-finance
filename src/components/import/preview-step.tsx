"use client";

import * as React from "react";
import { AlertCircle, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DuplicateReason,
  ParsedRow,
} from "@/components/import/import-model";
import type { Option } from "@/components/import/wizard-parts";

export interface PreviewRow extends ParsedRow {
  duplicate?: DuplicateReason;
  categoryId: string;
  included: boolean;
}

type Filter = "all" | "selected" | "duplicates" | "errors";

const PAGE = 100;

export function PreviewStep({
  rows,
  currency,
  expenseCategories,
  incomeCategories,
  tag,
  onTagChange,
  onToggle,
  onSetIncluded,
  onCategoryChange,
}: {
  rows: PreviewRow[];
  currency: string;
  expenseCategories: Option[];
  incomeCategories: Option[];
  tag: string;
  onTagChange: (tag: string) => void;
  onToggle: (index: number) => void;
  onSetIncluded: (indexes: number[], included: boolean) => void;
  onCategoryChange: (index: number, categoryId: string) => void;
}) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [limit, setLimit] = React.useState(PAGE);

  const counts = React.useMemo(() => {
    const selected = rows.filter((row) => row.included);
    return {
      all: rows.length,
      selected: selected.length,
      duplicates: rows.filter((row) => row.duplicate).length,
      errors: rows.filter((row) => row.error).length,
      expenses: selected.filter((row) => row.kind === "expense"),
      income: selected.filter((row) => row.kind === "income"),
    };
  }, [rows]);

  const visible = React.useMemo(
    () =>
      rows.filter((row) => {
        if (filter === "selected") return row.included;
        if (filter === "duplicates") return Boolean(row.duplicate);
        if (filter === "errors") return Boolean(row.error);
        return true;
      }),
    [rows, filter],
  );
  const selectable = visible.filter((row) => !row.error).map((row) => row.index);

  const sum = (list: PreviewRow[]) =>
    list.reduce((total, row) => total + row.amount, 0);

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "selected", label: "To import", count: counts.selected },
    { value: "duplicates", label: "Duplicates", count: counts.duplicates },
    { value: "errors", label: "Errors", count: counts.errors },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">
            {counts.expenses.length} expense
            {counts.expenses.length === 1 ? "" : "s"}
          </p>
          <p className="truncate text-lg font-semibold text-red-600 dark:text-red-400">
            {formatCurrency(sum(counts.expenses), currency)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">
            {counts.income.length} income
          </p>
          <p className="truncate text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(sum(counts.income), currency)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="import-tag">Tag imported rows (optional)</Label>
        <Input
          id="import-tag"
          value={tag}
          onChange={(event) => onTagChange(event.target.value)}
          placeholder="e.g. import-sep-2026"
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={40}
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setFilter(item.value);
              setLimit(PAGE);
            }}
            aria-pressed={filter === item.value}
            className={cn(
              "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
              filter === item.value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent",
            )}
          >
            {item.label} · {item.count}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {counts.selected} of {counts.all} selected
        </p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            disabled={selectable.length === 0}
            onClick={() => onSetIncluded(selectable, true)}
          >
            Select all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            disabled={selectable.length === 0}
            onClick={() => onSetIncluded(selectable, false)}
          >
            Clear
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-2xl border text-sm text-muted-foreground">
          Nothing here.
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {visible.slice(0, limit).map((row) => (
            <PreviewItem
              key={row.index}
              row={row}
              currency={currency}
              options={row.kind === "expense" ? expenseCategories : incomeCategories}
              onToggle={onToggle}
              onCategoryChange={onCategoryChange}
            />
          ))}
        </ul>
      )}

      {visible.length > limit ? (
        <Button
          variant="outline"
          className="h-11 w-full sm:h-9"
          onClick={() => setLimit((value) => value + PAGE)}
        >
          Show {Math.min(PAGE, visible.length - limit)} more
        </Button>
      ) : null}
    </div>
  );
}

const PreviewItem = React.memo(function PreviewItem({
  row,
  currency,
  options,
  onToggle,
  onCategoryChange,
}: {
  row: PreviewRow;
  currency: string;
  options: Option[];
  onToggle: (index: number) => void;
  onCategoryChange: (index: number, categoryId: string) => void;
}) {
  const failed = Boolean(row.error);
  const checkboxId = `import-row-${row.index}`;
  return (
    <li
      className={cn(
        "flex gap-1 py-2 pr-3 md:items-center",
        failed && "bg-muted/40 text-muted-foreground",
      )}
    >
      <label
        htmlFor={checkboxId}
        className={cn(
          "flex w-12 shrink-0 items-start justify-center pt-2.5 md:items-center md:pt-0",
          failed ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <input
          id={checkboxId}
          type="checkbox"
          className="h-5 w-5 accent-primary"
          checked={row.included}
          disabled={failed}
          onChange={() => onToggle(row.index)}
          aria-label={`Import ${row.description || "row"}`}
        />
      </label>

      <div className="min-w-0 flex-1 space-y-2 md:flex md:items-center md:gap-4 md:space-y-0">
        <label
          htmlFor={checkboxId}
          className={cn(
            "flex min-w-0 flex-1 items-start justify-between gap-3 py-1",
            !failed && "cursor-pointer",
          )}
        >
          <div className="min-w-0 space-y-1">
            <p className={cn("truncate font-medium", failed && "font-normal")}>
              {row.description || row.notes || "(no description)"}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{row.date ? formatDate(row.date) : "—"}</span>
              {!failed ? (
                <span>· {row.kind === "expense" ? "Expense" : "Income"}</span>
              ) : null}
              {row.duplicate ? (
                <Badge variant="warning" className="gap-1 px-2 py-0">
                  <Copy className="h-3 w-3" />
                  {row.duplicate === "existing"
                    ? "Possible duplicate"
                    : "Repeated in file"}
                </Badge>
              ) : null}
              {failed ? (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {row.error}
                </span>
              ) : null}
            </div>
          </div>
          {!failed ? (
            <span
              className={cn(
                "shrink-0 font-medium tabular-nums",
                row.kind === "expense"
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {row.kind === "expense" ? "−" : "+"}
              {formatCurrency(row.amount, currency)}
            </span>
          ) : null}
        </label>

        {!failed ? (
          <Select
            value={row.categoryId || undefined}
            onValueChange={(value) => onCategoryChange(row.index, value)}
          >
            <SelectTrigger
              className="h-10 md:w-48 md:shrink-0"
              aria-label="Category"
            >
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </li>
  );
});
