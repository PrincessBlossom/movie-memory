"use client";

import type { FactState } from "@/hooks/useFact";

/**
 * Renders every state of the fact lifecycle:
 * - waiting:  a movie edit is saving; the fact will follow
 * - loading:  skeleton (first load) or dimmed current fact (refresh)
 * - error:    message + retry; a previous fact stays visible if there is one
 * - empty:    nothing loaded and nothing in progress
 * - success:  the fact, its time, and whether it came from the 30s cache
 */
export function FactCard({
  fact,
  fromCache,
  isLoading,
  error,
  refresh,
  isWaitingForMovie,
}: FactState & { refresh: () => void; isWaitingForMovie: boolean }) {
  const busy = isLoading || isWaitingForMovie;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xs font-semibold tracking-widest text-brand uppercase">
          Fun fact
        </h2>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="link-underline cursor-pointer text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Generating…" : "New fact"}
        </button>
      </div>

      <div aria-live="polite" aria-busy={busy}>
        {isWaitingForMovie ? (
          <p className="text-ink/60">Saving your new movie. A fresh fact is on the way…</p>
        ) : fact ? (
          <div className={isLoading ? "opacity-50 transition-opacity" : undefined}>
            <p className="leading-relaxed text-ink">{fact.content}</p>
            <p className="mt-2 text-xs text-ink/50">
              Generated {formatTime(fact.createdAt)}
              {fromCache && " · from cache"}
            </p>
          </div>
        ) : isLoading ? (
          <FactSkeleton />
        ) : error ? null : (
          <p className="text-ink/60">No fact yet. Click “New fact” to get one.</p>
        )}
      </div>

      {error && !isWaitingForMovie && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          <span>{error.message}</span>
          <button
            type="button"
            onClick={refresh}
            className="cursor-pointer font-semibold whitespace-nowrap underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function FactSkeleton() {
  return (
    <div className="animate-pulse space-y-2" aria-label="Loading fun fact">
      <div className="h-4 w-full rounded bg-ink/10" />
      <div className="h-4 w-2/3 rounded bg-ink/10" />
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
