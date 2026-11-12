"use client";

import type { FactCardView } from "../types";

/**
 * Renders the fact card. The shell has already decided which state applies
 * (waiting, loading, fact, empty, error) and formatted everything; see
 * toFactCardView in ../transforms.ts.
 */
export function FactCard({ view, onRefresh }: { view: FactCardView; onRefresh: () => void }) {
  const { body, error, busy, refreshLabel } = view;

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
            if (!busy) onRefresh();
          }}
          aria-disabled={busy}
          className="link-underline cursor-pointer text-sm font-semibold"
        >
          {refreshLabel}
        </button>
      </div>

      <div aria-live="polite" aria-busy={busy}>
        {body.kind === "waiting" && <p className="text-ink/70">{body.message}</p>}
        {body.kind === "loading" && <FactSkeleton />}
        {body.kind === "empty" && <p className="text-ink/70">{body.message}</p>}
        {body.kind === "fact" && (
          <div className={body.dimmed ? "opacity-50 transition-opacity" : undefined}>
            {body.notice && (
              <p className="mb-2 text-sm font-semibold text-ink/70">{body.notice}</p>
            )}
            <p className="leading-relaxed text-ink">{body.content}</p>
            <p className="mt-2 text-xs text-ink/70">{body.meta}</p>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
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
      {/* aria-label is ignored on a plain div; text is announced. */}
      <span className="sr-only">Loading fun fact…</span>
      <div aria-hidden="true" className="h-4 w-full rounded bg-ink/10" />
      <div aria-hidden="true" className="h-4 w-2/3 rounded bg-ink/10" />
    </div>
  );
}
