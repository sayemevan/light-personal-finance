"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RowActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  /** Optional additional items rendered above edit/delete. */
  children?: React.ReactNode;
}

/** Consistent per-row action menu used by every data table. */
export function RowActions({ onEdit, onDelete, children }: RowActionsProps) {
  // Rows are often clickable (edit / view details). Because menu clicks bubble
  // up the React tree — even through Radix's portal — stop propagation here so
  // opening the menu or picking an item never also triggers the row's onClick.
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <span
      className="inline-flex"
      onClick={stop}
      onPointerDown={stop}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full sm:h-8 sm:w-8 sm:rounded-md"
            aria-label="Open actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {children}
          {onEdit ? (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
          ) : null}
          {onEdit && onDelete ? <DropdownMenuSeparator /> : null}
          {onDelete ? (
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
