/**
 * Presentation helpers for currency, numbers and dates. Kept pure and
 * dependency-free so they can run on the server or the client.
 */

const DEFAULT_LOCALE = "en-US";
const DEFAULT_CURRENCY = "USD";

export function formatCurrency(
  value: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    // "৳1,250" rather than "BDT 1,250" — shorter, and what people expect.
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Short form for tight spaces on phones, e.g. "৳95K", "৳1.2M". */
export function formatCompactCurrency(
  value: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(
  value: number,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Parse a stored date. Bare calendar dates ("YYYY-MM-DD", "YYYY-MM") are read
 * as local midnight; `new Date("YYYY-MM-DD")` would read UTC midnight and show
 * the previous day west of UTC.
 */
function parseCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? 1));
  }
  return new Date(value);
}

export function formatDate(
  value: string | Date,
  locale: string = DEFAULT_LOCALE,
): string {
  const date = typeof value === "string" ? parseCalendarDate(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatMonth(
  value: string | Date,
  locale: string = DEFAULT_LOCALE,
): string {
  const date = typeof value === "string" ? parseCalendarDate(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(date);
}
