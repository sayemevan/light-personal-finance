/**
 * Pure schedule maths for recurring rules. No I/O, safe on server and client.
 *
 * All dates are calendar dates ("YYYY-MM-DD") and are manipulated in UTC so
 * results never shift with the host's timezone.
 */
import type {
  RecurringFrequency,
  RecurringKind,
  RecurringRule,
} from "@/types/domain";

/** Hard cap on loop iterations so malformed data can never hang a request. */
const MAX_ITERATIONS = 50_000;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parts(dateISO: string): { y: number; m: number; d: number } {
  const [y = 1970, m = 1, d = 1] = dateISO.split("-").map(Number);
  return { y, m, d };
}

function toISO(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(
    d,
  ).padStart(2, "0")}`;
}

/** Days in a 1-based month. */
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Add whole days to a calendar date. */
export function addDays(dateISO: string, days: number): string {
  const { y, m, d } = parts(dateISO);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return toISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Today's date in the runtime's local timezone (the user's, on the client). */
export function todayISO(now: Date = new Date()): string {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Day-of-month that monthly/yearly schedules stick to: the start date's. */
export function anchorDayOf(rule: Pick<RecurringRule, "startDate">): number {
  return parts(rule.startDate).d || 1;
}

/**
 * The occurrence after `dateISO`. Monthly and yearly schedules keep
 * `anchorDay`, clamped to the month's length, so Jan 31 → Feb 28/29 → Mar 31
 * and a Feb 29 yearly rule lands on Feb 28 in non-leap years.
 */
export function advanceDate(
  dateISO: string,
  frequency: RecurringFrequency,
  interval: number,
  anchorDay: number,
): string {
  const step = Math.max(1, Math.floor(interval) || 1);
  switch (frequency) {
    case "daily":
      return addDays(dateISO, step);
    case "weekly":
      return addDays(dateISO, step * 7);
    case "monthly": {
      const { y, m } = parts(dateISO);
      const index = y * 12 + (m - 1) + step;
      const ny = Math.floor(index / 12);
      const nm = (index % 12) + 1;
      return toISO(ny, nm, Math.min(anchorDay, daysInMonth(ny, nm)));
    }
    case "yearly": {
      const { y, m } = parts(dateISO);
      const ny = y + step;
      return toISO(ny, m, Math.min(anchorDay, daysInMonth(ny, m)));
    }
  }
}

type ScheduleFields = Pick<
  RecurringRule,
  "frequency" | "interval" | "startDate" | "endDate"
>;

/** The occurrence following `dateISO` on the rule's schedule. */
export function nextOccurrence(rule: ScheduleFields, dateISO: string): string {
  return advanceDate(dateISO, rule.frequency, rule.interval, anchorDayOf(rule));
}

/** Whether `dateISO` is still inside the rule's (optional) end date. */
export function withinEnd(rule: Pick<RecurringRule, "endDate">, dateISO: string) {
  return !rule.endDate || dateISO <= rule.endDate;
}

/**
 * First occurrence on the schedule (counting from the start date) that is on
 * or after `fromISO`.
 */
export function firstOccurrenceOnOrAfter(
  rule: ScheduleFields,
  fromISO: string,
): string {
  let date = rule.startDate;
  for (let i = 0; date < fromISO && i < MAX_ITERATIONS; i += 1) {
    date = nextOccurrence(rule, date);
  }
  return date;
}

/**
 * Occurrences that are due: from `nextDate`, every date ≤ today and ≤ the end
 * date, at most `max`. Paused rules have nothing due.
 */
export function occurrencesDue(
  rule: RecurringRule,
  todayISO: string,
  max = 24,
): string[] {
  if (!rule.isActive || !rule.nextDate) return [];
  const due: string[] = [];
  let date = rule.nextDate;
  while (date <= todayISO && withinEnd(rule, date) && due.length < max) {
    due.push(date);
    date = nextOccurrence(rule, date);
  }
  return due;
}

export interface UpcomingOccurrence {
  rule: RecurringRule;
  date: string;
}

/**
 * Forecast: occurrences of active rules dated within [from, from + days],
 * sorted by date. Dates before `from` (overdue) are not included.
 */
export function upcomingOccurrences(
  rules: RecurringRule[],
  fromISO: string,
  days: number,
): UpcomingOccurrence[] {
  const until = addDays(fromISO, days);
  const out: UpcomingOccurrence[] = [];
  for (const rule of rules) {
    if (!rule.isActive || !rule.nextDate) continue;
    let date = rule.nextDate;
    for (
      let i = 0;
      date <= until && withinEnd(rule, date) && i < MAX_ITERATIONS;
      i += 1
    ) {
      if (date >= fromISO) out.push({ rule, date });
      date = nextOccurrence(rule, date);
    }
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.rule.name.localeCompare(b.rule.name),
  );
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function every(interval: number, unit: string): string {
  return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
}

/** Human description, e.g. "Every month on the 5th", "Every 2 weeks on Friday". */
export function describeSchedule(rule: ScheduleFields): string {
  const interval = Math.max(1, Math.floor(rule.interval) || 1);
  const { y, m, d } = parts(rule.startDate);
  switch (rule.frequency) {
    case "daily":
      return every(interval, "day");
    case "weekly": {
      const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
      return `${every(interval, "week")} on ${weekday ?? ""}`.trim();
    }
    case "monthly":
      return `${every(interval, "month")} on the ${
        d === 31 ? "last day" : ordinal(d)
      }`;
    case "yearly":
      return `${every(interval, "year")} on ${d} ${MONTHS[m - 1] ?? ""}`.trim();
  }
}

/** Average number of occurrences per month, for normalising commitments. */
export function occurrencesPerMonth(
  rule: Pick<RecurringRule, "frequency" | "interval">,
): number {
  const interval = Math.max(1, Math.floor(rule.interval) || 1);
  switch (rule.frequency) {
    case "daily":
      return 365.25 / 12 / interval;
    case "weekly":
      return 365.25 / 7 / 12 / interval;
    case "monthly":
      return 1 / interval;
    case "yearly":
      return 1 / (12 * interval);
  }
}

/** Monthly totals of active rules by kind. */
export function monthlyCommitments(
  rules: RecurringRule[],
): Record<RecurringKind, number> {
  const totals: Record<RecurringKind, number> = {
    expense: 0,
    income: 0,
    transfer: 0,
  };
  for (const rule of rules) {
    if (!rule.isActive) continue;
    totals[rule.kind] += rule.amount * occurrencesPerMonth(rule);
  }
  return totals;
}
