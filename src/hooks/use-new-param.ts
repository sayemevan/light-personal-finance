"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Opens a page's create form when it is reached with `?new=1` (app shortcuts,
 * the header "Add expense" button), then strips the flag from the URL.
 */
export function useNewParam(open: () => void) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const wantsNew = searchParams.get("new") === "1";

  React.useEffect(() => {
    if (!wantsNew) return;
    // Synchronous (unlike router.replace) so it can't later overwrite the
    // history entry the form sheet pushes for back-to-close.
    window.history.replaceState(window.history.state, "", pathname);
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsNew]);
}
