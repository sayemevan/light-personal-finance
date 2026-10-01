import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface ImportSummary {
  expenses: number;
  income: number;
  skippedDuplicates: number;
  failed: number;
}

function plural(count: number, word: string, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

export function DoneStep({
  summary,
  onRestart,
}: {
  summary: ImportSummary;
  onRestart: () => void;
}) {
  const skipped = [
    summary.skippedDuplicates > 0
      ? `Skipped ${plural(summary.skippedDuplicates, "duplicate")}.`
      : "",
    summary.failed > 0
      ? `${plural(summary.failed, "row")} couldn't be read.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-4 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Import complete</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Imported {plural(summary.expenses, "expense")} and{" "}
          {summary.income} income. {skipped}
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
        {summary.expenses > 0 ? (
          <Button asChild className="h-11 sm:h-9">
            <Link href="/expenses">View expenses</Link>
          </Button>
        ) : null}
        {summary.income > 0 ? (
          <Button
            asChild
            variant={summary.expenses > 0 ? "outline" : "default"}
            className="h-11 sm:h-9"
          >
            <Link href="/income">View income</Link>
          </Button>
        ) : null}
        <Button variant="ghost" className="h-11 sm:h-9" onClick={onRestart}>
          Import another file
        </Button>
      </div>
    </div>
  );
}
