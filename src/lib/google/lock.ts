import "server-only";

/**
 * In-process queue: callers with the same key run one at a time within this
 * server instance. It does not coordinate across instances. Sheets offers no
 * reliable cross-instance lock (concurrent `addSheet` calls with one title
 * all succeed, renamed `<title>_conflict<n>`), so correctness across
 * instances comes from the data layout instead: rows are never physically
 * deleted (see `SheetRepository.remove`) and repeatable writes use
 * deterministic ids plus `keepFirstOf` to drop duplicates.
 */
const chains = new Map<string, Promise<unknown>>();

export async function withLocalLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  chains.set(key, run);
  try {
    return await run;
  } finally {
    if (chains.get(key) === run) chains.delete(key);
  }
}
