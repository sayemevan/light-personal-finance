/**
 * Dependency-free CSV parsing plus the amount/date helpers needed to read bank,
 * bKash, Nagad and credit-card statements. Pure and client-safe.
 */

export type CsvDelimiter = "," | ";" | "\t";

const DELIMITERS: CsvDelimiter[] = [",", ";", "\t"];

/** Count delimiters outside quotes on one line (delimiter sniffing only). */
function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === delimiter && !inQuotes) count++;
  }
  return count;
}

/**
 * Pick the delimiter that splits the first lines most consistently into more
 * than one column. Falls back to a comma.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== "")
    .slice(0, 20);
  let best: CsvDelimiter = ",";
  let bestScore = 0;
  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => countOutsideQuotes(line, delimiter));
    const nonZero = counts.filter((count) => count > 0);
    if (nonZero.length === 0) continue;
    // Most common column count among lines that use this delimiter.
    const freq = new Map<number, number>();
    for (const count of nonZero) freq.set(count, (freq.get(count) ?? 0) + 1);
    const [mode, modeHits] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
    const score = modeHits * Math.log2(mode + 1);
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

/**
 * Parse CSV text into rows of string cells. Handles quoted fields, escaped
 * quotes (`""`), delimiters and newlines inside quotes, CRLF/CR line endings
 * and a leading BOM. Fully blank lines are dropped.
 */
export function parseCsv(
  input: string,
  delimiter: CsvDelimiter = detectDelimiter(input),
): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endRow = () => {
    row.push(field);
    field = "";
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"' && field.trim() === "") {
      // Opening quote (leading whitespace before it is discarded).
      field = "";
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      endRow();
      if (text[i + 1] === "\n") i++;
    } else if (char === "\n") {
      endRow();
    } else {
      field += char;
    }
    i++;
  }
  if (field !== "" || row.length > 0) endRow();

  return rows.map((cells) => cells.map((value) => value.trim()));
}

const HEADER_WORDS =
  /date|desc|detail|narration|particular|amount|debit|credit|withdraw|deposit|balance|remark|reference|ref|merchant|transaction|txn|type|note|memo|payee/i;

/**
 * Guess which row is the header: the first row in the first 30 with at least
 * three non-empty cells that look like labels (not numbers/dates), preferring
 * rows that contain typical statement words.
 */
export function detectHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, 30);
  let fallback = -1;
  for (let index = 0; index < limit; index++) {
    const cells = (rows[index] ?? []).filter((value) => value.trim() !== "");
    if (cells.length < 3) continue;
    const textual = cells.filter(
      (value) => !/^[\d\s.,()/:+\-–৳$]+$/.test(value) && value.length <= 60,
    );
    if (textual.length < Math.ceil(cells.length * 0.6)) continue;
    if (cells.some((value) => HEADER_WORDS.test(value))) return index;
    if (fallback < 0) fallback = index;
  }
  return fallback < 0 ? 0 : fallback;
}

/**
 * Parse a statement amount. Returns a signed number, or `null` if the text is
 * not a number. Handles thousands separators, currency marks ("৳", "Tk",
 * "BDT", "$"), "(1,234.50)" negatives, leading/trailing minus and "Dr"/"Cr"
 * suffixes (Dr = negative / money out, Cr = positive / money in).
 */
export function parseAmount(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let text = String(raw).trim();
  if (text === "" || text === "-" || text === "—") return null;

  let negative = false;

  // "1,250.00 Dr", "1,250.00Dr" and "500CR" alike. `\b` would miss the
  // unspaced forms: there is no word boundary between "0" and "D".
  const drCr = text.match(/(^|[^a-z])(dr|cr)\.?$/i);
  if (drCr) {
    if (drCr[2]?.toLowerCase() === "dr") negative = true;
    text = text.slice(0, (drCr.index ?? 0) + (drCr[1]?.length ?? 0)).trim();
  }

  if (/^\(.*\)$/.test(text)) {
    negative = !negative;
    text = text.slice(1, -1).trim();
  }

  // Strip currency symbols / codes.
  text = text
    .replace(/৳|\$|€|£|₹|tk\.?|bdt|usd|inr/gi, "")
    .replace(/\s+/g, "")
    .trim();

  if (/^-/.test(text) || /-$/.test(text)) {
    negative = !negative;
    text = text.replace(/^-|-$/g, "");
  }
  if (text.startsWith("+")) text = text.slice(1);

  // Normalise separators: "1.234,50" (EU) vs "1,234.50".
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d{1,2}$/.test(text)) {
    text = text.replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }

  if (!/^\d*\.?\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

export type DateFormat =
  | "YYYY-MM-DD"
  | "DD/MM/YYYY"
  | "MM/DD/YYYY"
  | "DD-MM-YYYY"
  | "DD MMM YYYY";

export const DATE_FORMATS: DateFormat[] = [
  "YYYY-MM-DD",
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "DD-MM-YYYY",
  "DD MMM YYYY",
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function expandYear(year: number): number {
  if (year >= 100) return year;
  return year < 70 ? 2000 + year : 1900 + year;
}

function toIso(year: number, month: number, day: number): string | null {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Parse a date cell in the given format into "YYYY-MM-DD". A trailing time
 * ("05/09/2026 14:32") is ignored. Returns `null` when it does not match.
 */
export function parseDate(
  raw: string | undefined | null,
  format: DateFormat,
): string | null {
  if (!raw) return null;
  const text = String(raw)
    .trim()
    .replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(am|pm|z)?.*$/i, "")
    .trim();
  if (text === "") return null;

  let match: RegExpMatchArray | null;
  /** Numeric value of a regex group (0 when missing). */
  const n = (group: number) => Number(match?.[group] ?? 0);
  switch (format) {
    case "YYYY-MM-DD":
      match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      return match ? toIso(n(1), n(2), n(3)) : null;
    case "DD/MM/YYYY":
      match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/);
      return match
        ? toIso(expandYear(n(3)), n(2), n(1))
        : null;
    case "MM/DD/YYYY":
      match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/);
      return match
        ? toIso(expandYear(n(3)), n(1), n(2))
        : null;
    case "DD-MM-YYYY":
      match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);
      return match
        ? toIso(expandYear(n(3)), n(2), n(1))
        : null;
    case "DD MMM YYYY": {
      match = text.match(/^(\d{1,2})[\s\-/.]+([a-z]{3,9})[\s\-/.,]+(\d{2}|\d{4})$/i);
      if (!match) return null;
      const month = MONTHS[(match[2] ?? "").toLowerCase().slice(0, 3)];
      return month ? toIso(expandYear(n(3)), month, n(1)) : null;
    }
  }
}

/**
 * Pick the format that parses the most sample values. Ties between
 * DD/MM/YYYY and MM/DD/YYYY resolve to day-first (the norm in Bangladesh).
 */
export function detectDateFormat(samples: string[]): DateFormat {
  const values = samples.filter((value) => value && value.trim() !== "");
  let best: DateFormat = "YYYY-MM-DD";
  let bestHits = -1;
  for (const format of DATE_FORMATS) {
    const hits = values.filter((value) => parseDate(value, format)).length;
    if (hits > bestHits) {
      best = format;
      bestHits = hits;
    }
  }
  return best;
}
