/**
 * Browser-side PWA helpers: offline-data cleanup and reminder notifications.
 * Everything is feature-detected and swallows errors — callers can fire and
 * forget, and nothing here runs during SSR.
 */
import { clearQueue } from "@/lib/offline-queue";
import type { ReminderItem, RemindersResponse } from "@/types/reminders";
import type { ApiResponse } from "@/types/api";

/** Must match META_CACHE / NOTIFIED_KEY in public/sw.js. */
const META_CACHE = "pf-meta";
const NOTIFIED_KEY = "/__pf/notified-reminders";
const NOTIFIED_STORAGE_KEY = "pf.notified-reminders.v1";
const NOTIFICATION_ICON = "/icons/icon-192.png";
const PERIODIC_SYNC_TAG = "reminders";
const PERIODIC_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

export type ReminderSupport = "on" | "off" | "blocked" | "unsupported";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Local "YYYY-MM-DD". */
function todayKey(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---------------------------------------------------------------------------
// Offline data
// ---------------------------------------------------------------------------

/**
 * Wipe cached API data / pages, the offline write queue and reminder
 * bookkeeping. Used on sign-out and from Settings.
 */
export async function clearOfflineData(): Promise<void> {
  if (!isBrowser()) return;
  clearQueue();
  try {
    window.localStorage.removeItem(NOTIFIED_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR" });
  } catch {
    // ignore
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("pf-api-") ||
              key.startsWith("pf-pages-") ||
              key === META_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

/** Current notification status for the Settings card. */
export function getReminderSupport(): ReminderSupport {
  if (!isBrowser() || !("Notification" in window)) return "unsupported";
  try {
    const permission = Notification.permission;
    if (permission === "granted") return "on";
    if (permission === "denied") return "blocked";
    return "off";
  } catch {
    return "unsupported";
  }
}

/** Ask for notification permission. Resolves with the resulting status. */
export async function requestReminderPermission(): Promise<ReminderSupport> {
  if (getReminderSupport() === "unsupported") return "unsupported";
  try {
    // Older Safari uses the callback form and returns undefined.
    const result = await new Promise<NotificationPermission>((resolve) => {
      const maybe = Notification.requestPermission(resolve);
      if (maybe && typeof maybe.then === "function") {
        void maybe.then(resolve, () => resolve(Notification.permission));
      }
    });
    if (result === "granted") return "on";
    if (result === "denied") return "blocked";
    return "off";
  } catch {
    return getReminderSupport();
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isBrowser() || !("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

function readLocalNotified(): string[] {
  try {
    const raw = window.localStorage.getItem(NOTIFIED_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { date?: string; ids?: unknown };
    if (data?.date !== todayKey() || !Array.isArray(data.ids)) return [];
    return data.ids.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

/** Ids the service worker already notified about today (background sync). */
async function readSharedNotified(): Promise<string[]> {
  try {
    if (!("caches" in window)) return [];
    const cache = await caches.open(META_CACHE);
    const res = await cache.match(NOTIFIED_KEY);
    if (!res) return [];
    const data = (await res.json()) as { date?: string; ids?: unknown };
    if (data?.date !== todayKey() || !Array.isArray(data.ids)) return [];
    return data.ids.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

async function writeNotified(ids: string[]): Promise<void> {
  const payload = JSON.stringify({ date: todayKey(), ids });
  try {
    window.localStorage.setItem(NOTIFIED_STORAGE_KEY, payload);
  } catch {
    // ignore
  }
  try {
    if ("caches" in window) {
      const cache = await caches.open(META_CACHE);
      await cache.put(
        NOTIFIED_KEY,
        new Response(payload, {
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
  } catch {
    // ignore
  }
}

async function fetchReminders(): Promise<ReminderItem[]> {
  try {
    const res = await fetch("/api/reminders", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    // Don't notify from stale offline data served by the service worker.
    if (!res.ok || res.headers.get("x-from-cache") === "1") return [];
    const json = (await res.json()) as ApiResponse<RemindersResponse>;
    return json.ok && Array.isArray(json.data.items) ? json.data.items : [];
  } catch {
    return [];
  }
}

async function showReminder(
  item: ReminderItem,
  registration: ServiceWorkerRegistration | null,
): Promise<boolean> {
  const options: NotificationOptions = {
    body: item.body,
    tag: item.id,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    data: { url: item.url, id: item.id },
  };
  try {
    if (registration) {
      await registration.showNotification(item.title, options);
      return true;
    }
  } catch {
    // Fall back to a page notification below.
  }
  try {
    const notification = new Notification(item.title, options);
    notification.onclick = () => {
      try {
        window.focus();
        window.location.assign(item.url);
      } catch {
        // ignore
      }
      notification.close();
    };
    return true;
  } catch {
    // e.g. Android Chrome forbids the constructor without a service worker.
    return false;
  }
}

/**
 * Fetch reminders and show a notification for each one not yet shown today.
 * No-op unless notification permission is granted. Returns how many were
 * shown.
 */
export async function notifyDueReminders(): Promise<number> {
  if (getReminderSupport() !== "on") return 0;
  const items = await fetchReminders();
  if (items.length === 0) return 0;

  const seen = new Set([
    ...readLocalNotified(),
    ...(await readSharedNotified()),
  ]);
  const fresh = items.filter((item) => item?.id && !seen.has(item.id));
  if (fresh.length === 0) return 0;

  const registration = await getRegistration();
  let shown = 0;
  for (const item of fresh) {
    if (await showReminder(item, registration)) {
      seen.add(item.id);
      shown += 1;
    }
  }
  await writeNotified(Array.from(seen));
  return shown;
}

interface PeriodicSyncManagerLike {
  register(tag: string, options?: { minInterval: number }): Promise<void>;
  getTags?(): Promise<string[]>;
}

/**
 * Register background periodic sync for reminders where supported
 * (installed Chromium-based PWAs). The browser decides the real cadence.
 */
export async function registerReminderSync(): Promise<boolean> {
  if (getReminderSupport() !== "on") return false;
  const registration = await getRegistration();
  if (!registration) return false;
  const periodicSync = (
    registration as ServiceWorkerRegistration & {
      periodicSync?: PeriodicSyncManagerLike;
    }
  ).periodicSync;
  if (!periodicSync) return false;
  try {
    if ("permissions" in navigator) {
      const status = await navigator.permissions
        .query({ name: "periodic-background-sync" as PermissionName })
        .catch(() => null);
      if (status && status.state === "denied") return false;
    }
    await periodicSync.register(PERIODIC_SYNC_TAG, {
      minInterval: PERIODIC_SYNC_INTERVAL_MS,
    });
    return true;
  } catch {
    return false;
  }
}
