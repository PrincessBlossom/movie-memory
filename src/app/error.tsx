"use client";

import { useEffect } from "react";

/**
 * Error boundary for every page (e.g. the database is unreachable while
 * rendering the dashboard). Replaces Next's default error screen with a
 * branded message and a retry. Error details are logged, never shown: they
 * can contain internals.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="space-y-4 rounded-2xl bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold text-brand">Something went wrong</h1>
      <p className="text-ink/70">
        We couldn&apos;t load this page. It&apos;s probably temporary. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="cursor-pointer rounded-lg bg-brand px-6 py-3 font-semibold text-white transition-colors duration-[750ms] hover:bg-ink"
      >
        Try again
      </button>
      {error.digest && (
        // error log
        <p className="text-xs text-ink/70">Error reference: {error.digest}</p>
      )}
    </div>
  );
}
