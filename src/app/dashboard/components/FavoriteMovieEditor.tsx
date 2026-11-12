"use client";

import { useEffect, useRef } from "react";
import { TitleLengthHint } from "@/titlelength/TitleLengthHint";
import type { LengthHint } from "@/types/length-hint";

const labelClass = "text-xs font-semibold tracking-widest text-brand uppercase";
const primaryButton =
  "cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors duration-[750ms] hover:bg-ink";
const secondaryButton =
  "cursor-pointer rounded-lg border border-ink/20 px-4 py-2 text-sm font-semibold text-ink transition-colors duration-[750ms] hover:bg-mist";

/**
 * The favorite movie with an inline editor (Save + Cancel). Fully controlled:
 * the shell owns whether it's open, the draft, the error, and what Save does
 * (validation, the optimistic update, reopening with the error on failure).
 *
 * The component's own job is keyboard and screen reader behavior: Enter
 * saves, Escape cancels, opening focuses the input, and closing returns
 * focus to the Edit button instead of losing it when the form unmounts.
 */
export function FavoriteMovieEditor({
  movie,
  isSaving,
  isEditing,
  draft,
  error,
  lengthHint,
  onEdit,
  onDraftChange,
  onSave,
  onCancel,
}: {
  movie: string;
  isSaving: boolean;
  isEditing: boolean;
  draft: string;
  error: string | null;
  /** Character counter near or past the limit, or null. */
  lengthHint: LengthHint | null;
  onEdit: () => void;
  onDraftChange: (draft: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(isEditing);
  useEffect(() => {
    if (wasEditing.current && !isEditing) editButton.current?.focus();
    wasEditing.current = isEditing;
  }, [isEditing]);

  if (isEditing) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <label htmlFor="favorite-movie" className={labelClass}>
          Favorite movie
        </label>
        <input
          id="favorite-movie"
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
          aria-invalid={error !== null || lengthHint?.over === true}
          aria-describedby={
            [error && "favorite-movie-error", lengthHint && "favorite-movie-length"]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className="w-full rounded-lg border border-ink/20 bg-white px-4 py-2 text-lg font-semibold transition-colors duration-[750ms] focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
        />
        {lengthHint && <TitleLengthHint id="favorite-movie-length" hint={lengthHint} />}
        {error && (
          <p id="favorite-movie-error" role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" className={primaryButton}>
            Save
          </button>
          <button type="button" onClick={onCancel} className={secondaryButton}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className={labelClass}>Favorite movie</h2>
        {/* aria-disabled (not `disabled`) so focus can rest here during a
            save without being dropped. aria-label gives screen reader users
            the full name; it starts with the visible word "Edit" so speech
            control ("click Edit") still works (WCAG 2.5.3, label in name). */}
        <button
          ref={editButton}
          type="button"
          onClick={() => {
            if (!isSaving) onEdit();
          }}
          aria-disabled={isSaving}
          aria-label="Edit favorite movie"
          className="link-underline cursor-pointer text-sm font-semibold"
        >
          Edit
        </button>
      </div>
      <p className="text-2xl font-bold break-words text-ink">{movie}</p>
      <p aria-live="polite" className="h-5 text-sm text-ink/70">
        {isSaving ? "Saving…" : ""}
      </p>
    </div>
  );
}
