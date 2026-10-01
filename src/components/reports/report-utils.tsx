"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Percentage change from `previous` to `current`; null when undefined. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Average daily spend for a "YYYY-MM" month. The current month divides by the
 * days elapsed so far and projects a month-end total; past months divide by
 * the number of days in the month.
 */
export function dailyPace(month: string, spent: number, today = new Date()) {
  const [y = 0, m = 1] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const isCurrent = month === todayKey;
  const isFuture = month > todayKey;
  const daysCounted = isCurrent ? today.getDate() : isFuture ? 0 : daysInMonth;
  const average = daysCounted > 0 ? spent / daysCounted : 0;
  return {
    daysInMonth,
    daysCounted,
    isCurrent,
    average,
    projected: isCurrent ? average * daysInMonth : null,
  };
}

/** "2026-09" → "Sep 2026" (or "September" with `long`). */
export function monthLabel(month: string, long = false): string {
  const [y = 0, m = 1] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: long ? "long" : "short",
    year: long ? undefined : "numeric",
  });
}

/**
 * ▲/▼ percentage chip. `goodWhenUp` decides the colour: spending going up is
 * bad, income going up is good.
 */
export function ChangeIndicator({
  current,
  previous,
  goodWhenUp,
  className,
}: {
  current: number;
  previous: number;
  goodWhenUp: boolean;
  className?: string;
}) {
  const pct = percentChange(current, previous);
  const up = current > previous;
  const flat = current === previous;
  const good = flat ? null : up === goodWhenUp;
  const text =
    pct === null
      ? "new"
      : `${Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        good === null && "text-muted-foreground",
        good === true && "text-emerald-600 dark:text-emerald-400",
        good === false && "text-red-600 dark:text-red-400",
        className,
      )}
    >
      <span aria-hidden="true">{flat ? "•" : up ? "▲" : "▼"}</span>
      <span className="sr-only">{flat ? "No change" : up ? "Up" : "Down"}</span>
      {text}
    </span>
  );
}

/** Width of an element, tracked with a ResizeObserver (0 until measured). */
export function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** True below the `md` breakpoint (phones). */
export function useIsPhone() {
  const [phone, setPhone] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}

/**
 * Colours for categorical series. Mid-lightness HSL values read well on both
 * the light and dark card backgrounds (matching the category donut).
 */
export const SERIES_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(37 92% 50%)",
  "hsl(0 72% 51%)",
  "hsl(280 65% 60%)",
  "hsl(190 80% 42%)",
  "hsl(330 75% 55%)",
  "hsl(50 92% 50%)",
  "hsl(20 85% 55%)",
  "hsl(240 5% 60%)",
];
