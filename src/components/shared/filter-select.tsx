"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  /** Label for the "no filter" option. */
  allLabel?: string;
  className?: string;
}

export const ALL_VALUE = "__all__";

/** Compact single-select filter with an "all" reset option. */
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = "Filter",
  allLabel = "All",
  className,
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={
          className ??
          // Chip on phones (inside a horizontally scrolling row), fixed-width
          // select on larger screens.
          "h-9 w-auto min-w-[7.5rem] shrink-0 gap-2 rounded-full sm:w-[160px] sm:rounded-md max-sm:[&>span]:shrink-0"
        }
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
