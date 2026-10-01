"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";

import {
  OFFLINE_QUEUE_EVENT,
  describeQueued,
  flushQueue,
  queueSize,
} from "@/lib/offline-queue";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function subscribeQueue(callback: () => void) {
  window.addEventListener(OFFLINE_QUEUE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(OFFLINE_QUEUE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Replays writes queued while offline (on app start and whenever the device
 * comes back online) and shows a slim "You're offline" banner meanwhile.
 */
export function OfflineSync() {
  const queryClient = useQueryClient();
  const online = React.useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine !== false,
    () => true,
  );
  const pending = React.useSyncExternalStore(
    subscribeQueue,
    queueSize,
    () => 0,
  );

  const sync = React.useCallback(async () => {
    if (queueSize() === 0) return;
    try {
      const result = await flushQueue();
      for (const item of result.dropped) {
        toast.error(`Couldn't ${describeQueued(item)} saved offline`, {
          description: "The server rejected it, so it was discarded.",
        });
      }
      if (result.synced > 0) {
        await queryClient.invalidateQueries();
        toast.success(
          `Synced ${result.synced} offline change${result.synced === 1 ? "" : "s"}`,
        );
      }
    } catch {
      // Try again on the next online event / app start.
    }
  }, [queryClient]);

  React.useEffect(() => {
    void sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [sync]);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 pb-1 pt-[calc(env(safe-area-inset-top)+0.25rem)] text-xs font-medium text-amber-950 shadow-sm"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      <span>
        You&apos;re offline
        {pending > 0
          ? ` · ${pending} change${pending === 1 ? "" : "s"} waiting to sync`
          : " · showing saved data"}
      </span>
    </div>
  );
}
