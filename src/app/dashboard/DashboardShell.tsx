"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { ApiError, api, isApiError } from "@/lib/api";
import { factCache } from "@/lib/fact-cache";
import { FactCard } from "./components/FactCard";
import { FavoriteMovieEditor } from "./components/FavoriteMovieEditor";
import { ProfileHeader } from "./components/ProfileHeader";
import {
  toFactCardView,
  toLengthHint,
  toProfileView,
  toSaveFieldError,
  validateMovieDraft,
} from "./transforms";
import type { DashboardUser, EditorState } from "./types";
import { useFact } from "./useFact";

const CLOSED_EDITOR: EditorState = { isEditing: false, draft: "", error: null };

/**
 * The dashboard shell. It owns all state and I/O; the components it renders
 * only display props and report events.
 *
 * - Data: the server page seeds the user and movie (no fetch on first paint);
 *   facts come from useFact (30s cache, deduped requests, POST /api/fact).
 * - Transforms: API data becomes view models via pure functions in
 *   transforms.ts.
 * - Validation: the movie draft is checked here before any request, and a
 *   failed save is mapped back onto the editor's field.
 *
 * State ownership:
 * - `movie` is the title shown on screen. During a save it holds the
 *   optimistic new value; otherwise it matches what the server has stored.
 * - The fact hook gets `null` while saving, which pauses it. POST /api/fact
 *   reads the movie from the database, so a fetch mid-save could return a
 *   fact about the old title.
 */
export function DashboardShell({
  userId,
  user,
  initialMovie,
}: {
  userId: string;
  user: DashboardUser;
  initialMovie: string;
}) {
  const router = useRouter();
  const [movie, setMovie] = useState(initialMovie);
  const [isSaving, setIsSaving] = useState(false);
  const [editor, setEditor] = useState<EditorState>(CLOSED_EDITOR);
  const [isSigningOut, startSignOut] = useTransition();
  // saveCount is incremented on every save
  const saveCount = useRef(0);

  const fact = useFact(userId, isSaving ? null : movie);

  // --- Editor events -------------------------------------------------------

  function startEditing() {
    setEditor({ isEditing: true, draft: movie, error: null });
  }

  function changeDraft(draft: string) {
    setEditor((e) => ({ ...e, draft }));
  }

  function cancelEditing() {
    setEditor(CLOSED_EDITOR);
  }

  function submitEdit() {
    const check = validateMovieDraft(editor.draft, movie);
    if (check.kind === "invalid") {
      setEditor((e) => ({ ...e, error: check.error }));
      return;
    }
    setEditor(CLOSED_EDITOR); // close right away; the title updates optimistically
    if (check.kind === "valid") void saveMovie(check.title);
  }

  // --- Saving --------------------------------------------------------------

  async function saveMovie(title: string) {
    const previous = movie;
    const thisSave = ++saveCount.current;

    setMovie(title); // optimistic: show the new title immediately
    setIsSaving(true);
    try {
      const saved = await api.updateMovie(title);
      // The cached fact is about the old movie
      factCache.clear();
      setMovie(saved); 
    } catch (err) {
      const error = isApiError(err)
        ? err
        : new ApiError(0, "INTERNAL_ERROR", "Something went wrong.");

      setMovie(previous); // optimistic update

      const fieldError = toSaveFieldError(error);
      if (fieldError === null) {
        router.replace("/"); // session expired
      } else {
        setEditor({ isEditing: true, draft: title, error: fieldError });
      }
      if (error.code === "NETWORK_ERROR") {
        // Ambiguous network failure: the request may have reached the server before the connection dropped. Ask the server what it actually has.
        void reconcileWithServer(thisSave);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function reconcileWithServer(forSave: number) {
    try {
      const me = await api.getMe();
      if (forSave !== saveCount.current) return; // let the newer save persist
      if (me.favoriteMovie !== null) setMovie(me.favoriteMovie);
    } catch {
      // Still unreachable: keep the reverted value.
    }
  }

  // --- Sign out ------------------------------------------------------------

  function signOut() {
    startSignOut(async () => {
      // Cache entries are keyed by user id.
      // Clearing also removes this user's data from the tab.
      factCache.clear();
      await signOutAction(); // redirects to "/"
    });
  }

  return (
    <div className="space-y-6">
      <ProfileHeader
        profile={toProfileView(user)}
        isSigningOut={isSigningOut}
        onSignOut={signOut}
      />
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <FavoriteMovieEditor
          movie={movie}
          isSaving={isSaving}
          {...editor}
          lengthHint={editor.isEditing ? toLengthHint(editor.draft) : null}
          onEdit={startEditing}
          onDraftChange={changeDraft}
          onSave={submitEdit}
          onCancel={cancelEditing}
        />
      </section>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <FactCard view={toFactCardView(fact, isSaving)} onRefresh={fact.refresh} />
      </section>
    </div>
  );
}
