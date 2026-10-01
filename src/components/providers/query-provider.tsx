"use client";

import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";

import { ApiClientError } from "@/lib/api-client";

/** Errors a retry can't fix. */
const NO_RETRY = new Set([
  "NOT_FOUND",
  "VALIDATION",
  "UNAUTHENTICATED",
  "FORBIDDEN",
]);

const isRateLimited = (error: unknown) =>
  error instanceof ApiClientError && error.code === "RATE_LIMITED";

/**
 * Google's Sheets read quota is per minute, so a rate-limited read is worth
 * a few patient retries (5s, 10s, 20s); a quick retry would just fail again.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isRateLimited(error)) return failureCount < 3;
  if (error instanceof ApiClientError && NO_RETRY.has(error.code)) return false;
  return failureCount < 1;
}

function retryDelay(attempt: number, error: unknown): number {
  return isRateLimited(error)
    ? 5000 * 2 ** attempt
    : Math.min(1000 * 2 ** attempt, 30_000);
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Sheets reads are relatively expensive; cache aggressively and rely on
        // explicit invalidation after mutations.
        staleTime: 60 * 1000,
        retry: shouldRetry,
        retryDelay,
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
