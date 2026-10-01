"use client";

import * as React from "react";

const noopSubscribe = () => () => {};

/**
 * The user's current year and month (local time), or null during server
 * rendering. The server runs in UTC, so around a month boundary its month
 * can differ from the user's; reading it only on the client avoids a
 * hydration mismatch and a wrong "current month".
 */
export function useCalendarMonth(): { year: number; month: number } | null {
  const key = React.useSyncExternalStore(
    noopSubscribe,
    () => {
      const now = new Date();
      return `${now.getFullYear()}-${now.getMonth() + 1}`;
    },
    () => null,
  );
  return React.useMemo(() => {
    if (!key) return null;
    const [year, month] = key.split("-").map(Number);
    return { year: year!, month: month! };
  }, [key]);
}
