"use client";

import * as React from "react";
import { toast } from "sonner";

/** The build id names the worker's caches; see public/sw.js. */
const SW_URL = `/sw.js?v=${encodeURIComponent(
  process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
)}`;

function shouldRegister(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_SW === "1"
  );
}

/**
 * Registers the service worker (production, or dev with
 * `NEXT_PUBLIC_ENABLE_SW=1`) and offers a reload when a new version is
 * waiting. Renders nothing.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (!shouldRegister()) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let reloading = false;
    let prompted = false;
    const container = navigator.serviceWorker;

    const promptUpdate = (worker: ServiceWorker) => {
      if (prompted || cancelled) return;
      prompted = true;
      toast("Update available", {
        description: "A new version of the app is ready.",
        duration: Infinity,
        action: {
          label: "Reload",
          onClick: () => {
            reloading = true;
            try {
              worker.postMessage({ type: "SKIP_WAITING" });
            } catch {
              window.location.reload();
            }
          },
        },
      });
    };

    const onControllerChange = () => {
      // Only reload when the user asked for it (not on the first install).
      if (reloading) window.location.reload();
    };
    container.addEventListener("controllerchange", onControllerChange);

    const watch = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && container.controller) {
        promptUpdate(registration.waiting);
      }
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && container.controller) {
            promptUpdate(installing);
          }
        });
      });
    };

    let registration: ServiceWorkerRegistration | undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => undefined);
      }
    };

    const register = () => {
      container
        .register(SW_URL, { scope: "/" })
        .then((reg) => {
          if (cancelled) return;
          registration = reg;
          watch(reg);
          document.addEventListener("visibilitychange", onVisible);
        })
        .catch((error: unknown) => {
          console.warn("[sw] registration failed", error);
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      container.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
