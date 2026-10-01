"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { RECURRING_INVALIDATE, runRecurring } from "@/hooks/use-recurring";

const SESSION_FLAG = "pf:recurring-run";

function alreadyRan(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_FLAG) === "1";
  } catch {
    return false;
  }
}

function markRan(): void {
  try {
    window.sessionStorage.setItem(SESSION_FLAG, "1");
  } catch {
    // Storage blocked (private mode etc.) — the server lock still prevents
    // double posting, we may just run again on the next load.
  }
}

/**
 * Renders nothing. Once per browser session, posts any recurring
 * transactions that have come due and refreshes the affected views.
 */
export function RecurringRunner() {
  const queryClient = useQueryClient();
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current || alreadyRan()) return;
    started.current = true;

    runRecurring()
      .then((result) => {
        markRan();
        if (result.posted > 0) {
          toast.success(
            result.posted === 1
              ? "Added 1 recurring transaction"
              : `Added ${result.posted} recurring transactions`,
          );
          for (const key of RECURRING_INVALIDATE) {
            void queryClient.invalidateQueries({ queryKey: key });
          }
        } else if (result.pending.length > 0) {
          // Refresh so the dashboard shows what needs confirming.
          void queryClient.invalidateQueries({ queryKey: RECURRING_INVALIDATE[0] });
        }
      })
      .catch((error: unknown) => {
        // Silent: a failed background run retries on the next page load.
        console.error("[recurring] run failed", error);
      });
  }, [queryClient]);

  return null;
}
