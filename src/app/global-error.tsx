"use client";

/**
 * Root-level error boundary. Catches errors thrown in the root layout itself.
 * It must render its own <html>/<body> because it replaces the whole document.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-white text-neutral-900">
        <div className="mx-auto max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-neutral-500">
            A critical error occurred. Please reload the application.
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
