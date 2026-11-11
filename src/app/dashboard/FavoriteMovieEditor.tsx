"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiError } from "@/lib/api";
import { MOVIE_MAX_LENGTH } from "@/lib/constants";
import { movieTitleSchema } from "@/lib/validation";

export type SaveResult = { ok: true } | { ok: false; error: ApiError };

const labelClass = "text-xs font-semibold tracking-widest text-brand uppercase";
const primaryButton =
  "cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors duration-[750ms] hover:bg-ink";
const secondaryButton =
  "cursor-pointer rounded-lg border border-ink/20 px-4 py-2 text-sm font-semibold text-ink transition-colors duration-[750ms] hover:bg-mist";

/**
 * Shows the favorite movie with an inline editor (Save + Cancel).
 *
 * Flow:
 * - Edit opens the input with the current title. Enter saves, Escape cancels.
 * - Input is validated with the same zod schema the server uses, so obvious
 *   errors are caught without a request. The server still re-validates.
 * - An unchanged title closes the editor without a request.
 * - Focus is managed for keyboard and screen reader users: opening the editor
 *   focuses the input, and closing it (Save, Cancel or Escape) returns focus to
 *   the Edit button, instead of losing it when the form unmounts.
 * - On save the editor closes right away and the parent shows the new title
 *   optimistically. If the save fails, the parent reverts the title, and the
 *   editor reopens with the user's text and the error, so nothing typed is lost.
 */
export function FavoriteMovieEditor({
  movie,
  isSaving,
  onSave,
}: {
  movie: string;
  isSaving: boolean;
  onSave: (title: string) => Promise<SaveResult>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!isEditing && restoreFocus.current) {
      restoreFocus.current = false;
      editButton.current?.focus();
    }
  }, [isEditing]);

  function closeEditor() {
    restoreFocus.current = true;
    setIsEditing(false);
  }

  function startEditing() {
    setDraft(movie);
    setError(null);
    setIsEditing(true);
  }

  function cancel() {
    closeEditor();
    setError(null);
  }

  async function save() {
    const parsed = movieTitleSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid movie title.");
      return;
    }
    const title = parsed.data;
    if (title === movie) {
      cancel();
      return;
    }

    closeEditor();
    setError(null);
    const result = await onSave(title);
    if (!result.ok && result.error.code !== "UNAUTHORIZED") {
      setDraft(title);
      setError(result.error.message);
      setIsEditing(true);
    }
  }

  if (isEditing) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor="favorite-movie" className={labelClass}>
          Favorite movie
        </label>
        <input
          id="favorite-movie"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          maxLength={MOVIE_MAX_LENGTH}
          autoFocus
          aria-invalid={error !== null}
          aria-describedby={error ? "favorite-movie-error" : undefined}
          className="w-full rounded-lg border border-ink/20 bg-white px-4 py-2 text-lg font-semibold transition-colors duration-[750ms] focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
        />
        {error && (
          <p id="favorite-movie-error" role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" className={primaryButton}>
            Save
          </button>
          <button type="button" onClick={cancel} className={secondaryButton}>
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
            if (!isSaving) startEditing();
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
