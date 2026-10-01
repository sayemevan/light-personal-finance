/**
 * Calendar-month helpers for "YYYY-MM" keys, evaluated in the viewer's local
 * time zone (budgets follow the user's calendar, not UTC).
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parse(month: string): { year: number; index: number } {
  const [year = 1970, m = 1] = month.split("-").map(Number);
  return { year, index: m - 1 };
}

/** The current month as "YYYY-MM". */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** Move a "YYYY-MM" key by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const { year, index } = parse(month);
  const date = new Date(year, index + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** "Sep 2026". */
export function formatMonthShort(month: string, locale = "en-US"): string {
  const { year, index } = parse(month);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(new Date(year, index, 1));
}

export function daysInMonth(month: string): number {
  const { year, index } = parse(month);
  return new Date(year, index + 1, 0).getDate();
}

/**
 * Days left in `month` counting today: the whole month for a future month,
 * 0 for a past one.
 */
export function daysLeftInMonth(month: string, now: Date = new Date()): number {
  const current = currentMonthKey(now);
  if (month < current) return 0;
  if (month > current) return daysInMonth(month);
  return daysInMonth(month) - now.getDate() + 1;
}
