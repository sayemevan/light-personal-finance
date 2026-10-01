"use client";

import * as React from "react";

import { notifyDueReminders, registerReminderSync } from "@/lib/pwa";

/**
 * On app open: if notifications are allowed, shows today's not-yet-shown
 * reminders and (where supported) registers background periodic sync.
 * Renders nothing; never throws.
 */
export function ReminderNotifier() {
  React.useEffect(() => {
    let cancelled = false;
    // Let the first paint and the page's own queries go first.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void registerReminderSync().catch(() => undefined);
      void notifyDueReminders().catch(() => undefined);
    }, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
