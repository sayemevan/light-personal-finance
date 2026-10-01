/* eslint-disable */
/**
 * Personal Finance service worker.
 *
 * - Precaches the offline fallback page and icons.
 * - /_next/static/* and fonts: cache-first.
 * - Navigations: network-first; the cached copy (then /offline.html) is used
 *   only when the network fails or the device is offline, never just because
 *   the network is slow (a stale page can reference chunks a newer deploy
 *   has removed).
 * - GET /api/* (except /api/auth/*): network-first → last cached response,
 *   marked with `x-from-cache: 1`.
 * - Navigations to /api/* (OAuth callback, downloads): answered with the
 *   navigation preload response, so the request is never sent twice.
 * - periodicsync "reminders": fetches /api/reminders and shows notifications
 *   (deduped per day).
 *
 * Static and page caches are per build: the page registers
 * `/sw.js?v=<build id>`, so each deploy installs a new worker whose caches
 * start empty, and activating it deletes the previous build's caches (old
 * hashed chunks would otherwise pile up forever). API data keeps one cache
 * across deploys so offline data survives updates; it is wiped when another
 * user signs in (CLEAR).
 */

const BUILD = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC_CACHE = `pf-static-${BUILD}`;
const PAGES_CACHE = `pf-pages-${BUILD}`;
const API_CACHE = "pf-api-v1";
/** Unversioned: small bookkeeping (notified reminder ids) that survives updates. */
const META_CACHE = "pf-meta";
const NOTIFIED_KEY = "/__pf/notified-reminders";

const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];
const NOTIFICATION_ICON = "/icons/icon-192.png";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined),
  );
  // No skipWaiting() here: the page shows an "Update available" toast and
  // posts SKIP_WAITING when the user chooses to reload.
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, PAGES_CACHE, API_CACHE, META_CACHE]);
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("pf-") && !keep.has(key))
          .map((key) => caches.delete(key)),
      );
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (_) {
          // Not supported; fine.
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type === "CLEAR") {
    event.waitUntil(clearUserData());
  }
});

/** Drop everything tied to the signed-in user (API data, rendered pages). */
async function clearUserData() {
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

// ---------------------------------------------------------------------------
// Fetch routing
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // Never touch writes.

  const url = new URL(request.url);

  // Google Fonts (if ever used): cache-first.
  if (
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com"
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    if (request.mode === "navigate") {
      // Navigation preload has already sent this request. Not answering would
      // make the browser send it again, and a second hit on the OAuth
      // callback reuses its one-time code (Google: invalid_grant).
      event.respondWith(preloadOrFetch(event, request));
      return;
    }
    if (url.pathname.startsWith("/api/auth")) return; // Never cache auth.
    event.respondWith(apiNetworkFirst(event, request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(event, request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|ttf|otf)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
  // Everything else (RSC payloads, images, etc.) goes straight to the network.
});

/** Only same-origin, non-redirected 200s are safe to store. */
function isCacheable(response) {
  return (
    response &&
    response.ok &&
    response.status === 200 &&
    !response.redirected &&
    (response.type === "basic" || response.type === "cors")
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    return Response.error();
  }
}

/**
 * Network-first for page loads. Falls back to the cached copy only when the
 * device is offline or the request fails, so a slow but working connection
 * always gets the current page.
 */
async function navigationHandler(event, request) {
  const cache = await caches.open(PAGES_CACHE);

  if (self.navigator && self.navigator.onLine === false) {
    const cached = await cache.match(request);
    if (cached) return cached;
  }

  try {
    const preloaded = await Promise.resolve(event.preloadResponse).catch(
      () => undefined,
    );
    const response = preloaded || (await fetch(request));
    if (isCacheable(response)) {
      const copy = response.clone();
      event.waitUntil(cache.put(request, copy).catch(() => undefined));
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return (
      offline ||
      new Response("You're offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

/** The navigation preload response if there is one, else a plain fetch. */
async function preloadOrFetch(event, request) {
  const preloaded = await Promise.resolve(event.preloadResponse).catch(
    () => undefined,
  );
  return preloaded || fetch(request);
}

/** Network-first for API reads; falls back to the last good response. */
async function apiNetworkFirst(event, request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    const type = response.headers.get("content-type") || "";
    if (isCacheable(response) && type.includes("application/json")) {
      const copy = response.clone();
      event.waitUntil(cache.put(request, copy).catch(() => undefined));
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("x-from-cache", "1");
      return new Response(await cached.blob(), {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "OFFLINE",
          message: "You're offline and this data hasn't been loaded before.",
        },
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "x-from-cache": "0",
        },
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Reminders (periodic background sync + notification clicks)
// ---------------------------------------------------------------------------

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "reminders") {
    event.waitUntil(checkReminders());
  }
});

/** Local "YYYY-MM-DD". */
function todayKey() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Ids already notified today (shared with the page via the Cache API). */
async function readNotified() {
  try {
    const cache = await caches.open(META_CACHE);
    const res = await cache.match(NOTIFIED_KEY);
    if (!res) return [];
    const data = await res.json();
    if (!data || data.date !== todayKey() || !Array.isArray(data.ids)) {
      return [];
    }
    return data.ids;
  } catch (_) {
    return [];
  }
}

async function writeNotified(ids) {
  try {
    const cache = await caches.open(META_CACHE);
    await cache.put(
      NOTIFIED_KEY,
      new Response(JSON.stringify({ date: todayKey(), ids }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch (_) {
    // Best effort.
  }
}

async function checkReminders() {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return;
  }
  let items = [];
  try {
    const res = await fetch("/api/reminders", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return; // Signed out / error: stay quiet.
    const json = await res.json();
    if (!json || !json.ok || !json.data || !Array.isArray(json.data.items)) {
      return;
    }
    items = json.data.items;
  } catch (_) {
    return;
  }

  const notified = await readNotified();
  const seen = new Set(notified);
  const fresh = items.filter((item) => item && item.id && !seen.has(item.id));
  if (fresh.length === 0) return;

  for (const item of fresh) {
    try {
      await self.registration.showNotification(item.title, {
        body: item.body,
        tag: item.id,
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        data: { url: item.url || "/dashboard", id: item.id },
      });
      seen.add(item.id);
    } catch (_) {
      // Ignore one failed notification; try the rest.
    }
  }
  await writeNotified(Array.from(seen));
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || "/dashboard", self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = windows.find(
        (c) => new URL(c.url).origin === self.location.origin,
      );
      if (client) {
        try {
          await client.focus();
        } catch (_) {
          // Focus may be refused; still try to navigate.
        }
        if ("navigate" in client) {
          try {
            await client.navigate(target.href);
            return;
          } catch (_) {
            // Uncontrolled client: fall through to opening a window.
          }
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
