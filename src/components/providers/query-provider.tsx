"use client";

import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Sheets reads are relatively expensive; cache aggressively and rely on
        // explicit invalidation after mutations.
        staleTime: 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        // Try the request even when the browser reports offline, so the
        // service worker can answer from its cache; the default ("online")
        // pauses instead and never reaches it.
        networkMode: "offlineFirst",
      },
      mutations: {
        // Always run the mutation: apiFetch queues expense / income /
        // transfer writes while offline (see @/lib/offline-queue). The
        // default pauses offline mutations in memory instead, so the form
        // hangs on "Saving…" and the change is lost if the tab closes.
        networkMode: "always",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
