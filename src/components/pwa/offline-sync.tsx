"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";

import {
  OFFLINE_QUEUE_EVENT,
  claimOfflineData,
  describeQueued,
  flushQueue,
  queueSize,
} from "@/lib/offline-queue";
import { clearOfflineData } from "@/lib/pwa";

/** Retry interval while writes are waiting and the device seems online. */
const RETRY_MS = 30_000;

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
 * Replays writes queued while offline and shows a slim "You're offline"
 * banner meanwhile. Sync runs on app start, when the device comes back
 * online, when the tab becomes visible again, and every 30s while anything
 * is still waiting (e.g. the server was down, which fires no event).
 *
 * `userId` is the signed-in user. Offline data left by a different user on
 * this device is wiped before anything is replayed.
 */
export function OfflineSync({ userId }: { userId: string }) {
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

  const [ready, setReady] = React.useState(false);

  // Claim the device's offline data for this user before any sync.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (claimOfflineData(userId)) {
        await clearOfflineData().catch(() => undefined);
        await queryClient.invalidateQueries();
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, queryClient]);

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
    if (!ready) return;
    void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, sync]);

  React.useEffect(() => {
    if (!ready || !online || pending === 0) return;
    const timer = window.setInterval(() => void sync(), RETRY_MS);
    return () => window.clearInterval(timer);
  }, [ready, online, pending, sync]);

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
