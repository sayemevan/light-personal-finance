/**
 * Remembers the last account / category / payment method used per entry kind
 * so the next quick entry is pre-filled. Per-device convenience only, so it
 * lives in localStorage and every access tolerates storage being unavailable.
 */
export interface EntryMemory {
  accountId?: string;
  categoryId?: string;
  paymentMethod?: string;
}

const key = (kind: string) => `pf:last-entry:${kind}`;

export function readEntryMemory(kind: "expense" | "income"): EntryMemory {
  try {
    const raw = window.localStorage.getItem(key(kind));
    return raw ? (JSON.parse(raw) as EntryMemory) : {};
  } catch {
    return {};
  }
}

export function writeEntryMemory(
  kind: "expense" | "income",
  memory: EntryMemory,
): void {
  try {
    window.localStorage.setItem(key(kind), JSON.stringify(memory));
  } catch {
    // Storage blocked or full: nothing to remember, nothing breaks.
  }
}
