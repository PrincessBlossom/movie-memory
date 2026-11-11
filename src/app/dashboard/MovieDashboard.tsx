"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, isApiError } from "@/lib/api";
import { factCache } from "@/lib/fact-cache";
import { useFact } from "@/hooks/useFact";
import { FavoriteMovieEditor, type SaveResult } from "./FavoriteMovieEditor";
import { FactCard } from "./FactCard";

/**
 * Client-side part of the dashboard: the favorite movie (with inline editing)
 * and the fun fact.
 *
 * State ownership:
 * - `movie` is the title shown on screen. During a save it holds the
 *   optimistic new value; otherwise it matches what the server has stored.
 * - The fact hook gets `null` while saving, which pauses it. GET /api/fact
 *   reads the movie from the database, so a fetch mid-save could return a
 *   fact about the old title.
 */
export function MovieDashboard({
  userId,
  initialMovie,
}: {
  userId: string;
  initialMovie: string;
}) {
  const router = useRouter();
  const [movie, setMovie] = useState(initialMovie);
  const [isSaving, setIsSaving] = useState(false);
  // Incremented on every save, so a late reconciliation can't overwrite a newer edit.
  const saveCount = useRef(0);

  const fact = useFact(userId, isSaving ? null : movie);

  async function saveMovie(title: string): Promise<SaveResult> {
    const previous = movie;
    const thisSave = ++saveCount.current;

    setMovie(title); // optimistic: show the new title immediately
    setIsSaving(true);
    try {
      const saved = await api.updateMovie(title);
      // The cached fact is about the old movie. Entries are also keyed by
      // movie, so a stale one could never be served, but clearing makes the
      // invalidation explicit.
      factCache.clear();
      setMovie(saved); // server's normalized value is the source of truth
      return { ok: true };
    } catch (err) {
      const error = isApiError(err)
        ? err
        : new ApiError(0, "INTERNAL_ERROR", "Something went wrong.");

      setMovie(previous); // revert the optimistic update

      if (error.code === "UNAUTHORIZED") {
        router.replace("/");
      } else if (error.code === "NETWORK_ERROR") {
        // Ambiguous failure: the request may have reached the server before
        // the connection dropped. Ask the server what it actually has.
        void reconcileWithServer(thisSave);
      }
      return { ok: false, error };
    } finally {
      setIsSaving(false);
    }
  }

  async function reconcileWithServer(forSave: number) {
    try {
      const me = await api.getMe();
      if (forSave !== saveCount.current) return; // a newer save started; let it win
      if (me.favoriteMovie !== null) setMovie(me.favoriteMovie);
    } catch {
      // Still unreachable: keep the reverted value.
    }
  }

  return (
    <>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <FavoriteMovieEditor movie={movie} isSaving={isSaving} onSave={saveMovie} />
      </section>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <FactCard {...fact} isWaitingForMovie={isSaving} />
      </section>
    </>
  );
}
