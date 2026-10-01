"use client";

import * as React from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";

const UNDO_MS = 5000;

type Pending = { url: string; timer: number };
// Shared across hook instances so leaving the page still flushes deletes.
const pending = new Map<string, Pending>();

function flushAll() {
  for (const [key, item] of pending) {
    window.clearTimeout(item.timer);
    // keepalive lets the request finish even as the page unloads.
    void fetch(item.url, { method: "DELETE", keepalive: true }).catch(() => {});
    pending.delete(key);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushAll);
}

/** Remove one row (by id) from a cached array or paginated list. */
function withoutRow(data: unknown, id: string): unknown {
  if (Array.isArray(data)) {
    return data.filter((row: { id?: string }) => row?.id !== id);
  }
  if (data && typeof data === "object" && "items" in data) {
    const page = data as { items: { id?: string }[]; total: number };
    const items = page.items.filter((row) => row?.id !== id);
    return { ...page, items, total: page.total - (page.items.length - items.length) };
  }
  return data;
}

/**
 * Android-style delete: the row disappears at once and a toast offers Undo
 * for a few seconds; the delete request is only sent once that window
 * passes (or the page is closed).
 */
export function useUndoableDelete(options: {
  /** Cached lists the row should vanish from straight away. */
  listKey: QueryKey;
  /** Endpoint prefix, e.g. "/api/expenses" → DELETE /api/expenses/:id */
  endpoint: string;
  /** Queries to refresh once the delete has gone through. */
  invalidate: readonly QueryKey[];
}) {
  const queryClient = useQueryClient();
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  return React.useCallback(
    (id: string, message: string) => {
      const { listKey, endpoint, invalidate } = optionsRef.current;
      const key = `${endpoint}/${id}`;
      void queryClient.cancelQueries({ queryKey: listKey });
      queryClient.setQueriesData({ queryKey: listKey }, (data) =>
        withoutRow(data, id),
      );

      const refresh = () => {
        for (const queryKey of invalidate) {
          void queryClient.invalidateQueries({ queryKey });
        }
      };

      const timer = window.setTimeout(async () => {
        pending.delete(key);
        try {
          await api.delete(key);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Could not delete.",
          );
        } finally {
          refresh();
        }
      }, UNDO_MS);
      pending.set(key, { url: key, timer });

      toast(message, {
        duration: UNDO_MS,
        action: {
          label: "Undo",
          onClick: () => {
            const item = pending.get(key);
            if (!item) return;
            window.clearTimeout(item.timer);
            pending.delete(key);
            void queryClient.invalidateQueries({ queryKey: listKey });
          },
        },
      });
    },
    [queryClient],
  );
}
