"use client";

import * as React from "react";
import { Check, FileSpreadsheet, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { detectHeaderRow, parseCsv } from "@/lib/csv";
import { Card, CardContent } from "@/components/ui/card";

const MAX_BYTES = 5 * 1024 * 1024;
/** Candidate header rows offered to the user. */
const HEADER_CANDIDATES = 12;

export interface LoadedFile {
  name: string;
  rows: string[][];
}

export function FileStep({
  file,
  headerIndex,
  onLoad,
  onHeaderChange,
}: {
  file: LoadedFile | null;
  headerIndex: number;
  onLoad: (file: LoadedFile, headerIndex: number) => void;
  onHeaderChange: (index: number) => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);

  const handleFile = async (selected: File | undefined) => {
    if (!selected) return;
    setError(null);
    if (selected.size > MAX_BYTES) {
      setError("That file is larger than 5 MB. Split the statement and try again.");
      return;
    }
    setReading(true);
    try {
      const rows = parseCsv(await selected.text());
      if (rows.length < 2) {
        setError("That file doesn't contain any rows we could read.");
        return;
      }
      onLoad({ name: selected.name, rows }, detectHeaderRow(rows));
    } catch {
      setError("Couldn't read that file. Make sure it is a CSV export.");
    } finally {
      setReading(false);
    }
  };

  const dataRowCount = file ? Math.max(file.rows.length - headerIndex - 1, 0) : 0;

  return (
    <div className="space-y-4">
      <label
        className={cn(
          "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors hover:bg-accent/50 focus-within:ring-2 focus-within:ring-ring active:bg-accent",
          file && "min-h-0 flex-row justify-start gap-3 border-solid text-left",
        )}
      >
        {file ? (
          <>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {dataRowCount} row{dataRowCount === 1 ? "" : "s"} · tap to
                choose another file
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="h-6 w-6" />
            </div>
            <p className="font-medium">
              {reading ? "Reading file…" : "Choose a CSV statement"}
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Export the statement from your bank, bKash, Nagad or card app as
              CSV.
            </p>
          </>
        )}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {file ? (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <div className="space-y-1">
              <p className="font-medium">Which row has the column names?</p>
              <p className="text-sm text-muted-foreground">
                Statements often start with bank details. We picked the most
                likely row — tap another if it&apos;s wrong.
              </p>
            </div>
            <ul className="divide-y overflow-hidden rounded-xl border">
              {file.rows.slice(0, HEADER_CANDIDATES).map((row, index) => {
                const selected = index === headerIndex;
                const cells = row.filter((value) => value !== "");
                return (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => onHeaderChange(index)}
                      aria-pressed={selected}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors active:bg-accent",
                        selected ? "bg-primary/10" : "hover:bg-accent/50",
                        index < headerIndex && "text-muted-foreground",
                      )}
                    >
                      <span className="w-6 shrink-0 text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {cells.length ? cells.join(" · ") : "(empty)"}
                      </span>
                      {selected ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
