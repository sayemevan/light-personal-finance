"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Dim the range label while a new page is being fetched. */
  isLoading?: boolean;
  className?: string;
}

/**
 * Shared pagination footer: shows the current range, an optional page-size
 * selector, and previous / next controls. Works for both client- and
 * server-driven tables.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [15, 30, 50, 100],
  isLoading,
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        className,
      )}
    >
      <p
        className={cn(
          "text-xs text-muted-foreground sm:text-sm",
          isLoading && "opacity-60",
        )}
        aria-live="polite"
      >
        {total === 0
          ? "No results"
          : (
            <>
              <span className="hidden sm:inline">Showing </span>
              {`${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`}
            </>
          )}
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              className="hidden h-9 w-[130px] sm:flex"
              aria-label="Rows per page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <span className="hidden text-sm text-muted-foreground sm:inline">
          Page {currentPage} of {pageCount}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full sm:h-9 sm:w-9 sm:rounded-md"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full sm:h-9 sm:w-9 sm:rounded-md"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
