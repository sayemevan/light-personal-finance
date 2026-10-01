"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  HardDrive,
  Loader2,
  Printer,
} from "lucide-react";

import { downloadExport, useDriveExport } from "@/hooks/use-reports";
import type { ExportKind } from "@/types/reports";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CSV_OPTIONS: { kind: ExportKind; label: string }[] = [
  { kind: "expenses", label: "Expenses" },
  { kind: "income", label: "Income" },
  { kind: "transfers", label: "Transfers" },
  { kind: "all", label: "Everything" },
];

/** Reports header "Export" menu: CSV download, Drive copy and print. */
export function ExportMenu({ year }: { year: string }) {
  const [downloading, setDownloading] = React.useState(false);
  const drive = useDriveExport();
  const busy = downloading || drive.isPending;

  const download = async (kind: ExportKind) => {
    setDownloading(true);
    try {
      const fileName = await downloadExport({ kind, year });
      toast.success(`Downloaded ${fileName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setDownloading(false);
    }
  };

  const saveToDrive = () => {
    drive.mutate(
      { kind: "all", year },
      {
        onSuccess: ({ fileName, webViewLink }) =>
          toast.success(`Saved "${fileName}" to Drive › Reports`, {
            action: webViewLink
              ? {
                  label: "Open",
                  onClick: () =>
                    window.open(webViewLink, "_blank", "noopener,noreferrer"),
                }
              : undefined,
          }),
        onError: (error) =>
          toast.error(
            error instanceof Error ? error.message : "Could not save to Drive.",
          ),
      },
    );
  };

  return (
    <div data-print-hide>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9" disabled={busy}>
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download />
            )}
            Export
            <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Download CSV ({year})
          </DropdownMenuLabel>
          {CSV_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.kind}
              onSelect={() => void download(option.kind)}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {option.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={saveToDrive}>
            <HardDrive className="h-4 w-4" />
            Save to Google Drive
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              // Let the menu close before the print dialog snapshots the page.
              window.setTimeout(() => window.print(), 150);
            }}
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
