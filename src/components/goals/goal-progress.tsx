import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Goal } from "@/types/domain";

/** Share of the target saved so far, 0..1. */
export function goalRatio(goal: Goal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min(1, Math.max(0, (goal.savedAmount ?? 0) / goal.targetAmount));
}

export type GoalPace =
  | { kind: "reached" }
  | { kind: "behind" }
  | { kind: "monthly"; amount: number }
  | { kind: "open" };

/** Where a goal stands against its target and date. */
export function goalPace(
  goal: Goal,
  todayISO: string = new Date().toISOString().slice(0, 10),
): GoalPace {
  if ((goal.savedAmount ?? 0) >= goal.targetAmount) return { kind: "reached" };
  if (!goal.targetDate) return { kind: "open" };
  if (goal.targetDate < todayISO) return { kind: "behind" };
  return { kind: "monthly", amount: goal.monthlyNeeded ?? 0 };
}

export function GoalPaceText({
  goal,
  currency,
  className,
}: {
  goal: Goal;
  currency: string;
  className?: string;
}) {
  const pace = goalPace(goal);
  switch (pace.kind) {
    case "reached":
      return (
        <span
          className={cn(
            "font-medium text-emerald-600 dark:text-emerald-400",
            className,
          )}
        >
          Reached 🎉
        </span>
      );
    case "behind":
      return (
        <span
          className={cn("font-medium text-red-600 dark:text-red-400", className)}
        >
          Behind · target date passed
        </span>
      );
    case "monthly":
      return (
        <span className={cn("text-muted-foreground", className)}>
          Save {formatCurrency(pace.amount, currency)}/month to reach it
        </span>
      );
    default:
      return (
        <span className={cn("text-muted-foreground", className)}>
          No target date
        </span>
      );
  }
}

/** Circular progress with the percentage in the middle. */
export function ProgressRing({
  ratio,
  size = 56,
  stroke = 6,
  className,
}: {
  ratio: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, ratio));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.round(clamped * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={cn(
            "transition-[stroke-dashoffset] duration-300",
            clamped >= 1 ? "stroke-emerald-500" : "stroke-primary",
          )}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
