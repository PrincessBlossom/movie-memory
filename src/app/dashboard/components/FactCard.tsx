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
        {/* aria-disabled instead of `disabled`: a disabled button drops
            keyboard focus to <body> the moment it's clicked. aria-disabled
            keeps it focusable and announced as unavailable; the click guard
            enforces it. */}
        <button
          type="button"
          onClick={() => {
            if (!busy) refresh();
          }}
          aria-disabled={busy}
          className="link-underline cursor-pointer text-sm font-semibold"
        >
          {isLoading ? "Generating…" : "New fact"}
        </button>
      </div>

      <div aria-live="polite" aria-busy={busy}>
        {isWaitingForMovie ? (
          <p className="text-ink/70">Saving your new movie. A fresh fact is on the way…</p>
        ) : fact ? (
          <div className={isLoading ? "opacity-50 transition-opacity" : undefined}>
            {!fact.recognized && (
              // The model couldn't identify the title, so the fact is about a
              // similar film. Say so rather than pass it off as this movie.
              <p className="mb-2 text-sm font-semibold text-ink/70">
                We couldn&apos;t find a movie called “{fact.movie}”. Here&apos;s a fact
                about a similar film instead. Adding the year, or checking the
                spelling, can help.
              </p>
            )}
            <p className="leading-relaxed text-ink">{fact.content}</p>
            <p className="mt-2 text-xs text-ink/70">
              Generated {formatTime(fact.createdAt)}
              {fromCache && " · from cache"}
            </p>
          </div>
        ) : isLoading ? (
          <FactSkeleton />
        ) : error ? null : (
          <p className="text-ink/70">No fact yet. Click “New fact” to get one.</p>
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
            className="cursor-pointer rounded px-2 py-1 font-semibold whitespace-nowrap underline"
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
    <div className="animate-pulse space-y-2">
      {/* aria-label is ignored on a plain div; real text is announced. */}
      <span className="sr-only">Loading fun fact…</span>
      <div aria-hidden="true" className="h-4 w-full rounded bg-ink/10" />
      <div aria-hidden="true" className="h-4 w-2/3 rounded bg-ink/10" />
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
