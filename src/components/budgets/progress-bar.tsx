import { cn } from "@/lib/utils";

/** Green below 80%, amber 80–99%, red at or over the limit. */
export function progressTone(ratio: number): string {
  if (ratio >= 1) return "bg-red-500";
  if (ratio >= 0.8) return "bg-amber-500";
  return "bg-emerald-500";
}

interface ProgressBarProps {
  /** 0..∞; the bar is clamped to full width. */
  ratio: number;
  /** Tailwind background class for the fill; defaults to the budget tone. */
  toneClassName?: string;
  className?: string;
  label?: string;
}

export function ProgressBar({
  ratio,
  toneClassName,
  className,
  label,
}: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          toneClassName ?? progressTone(ratio),
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
