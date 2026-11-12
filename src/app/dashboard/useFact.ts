"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Fact } from "@/lib/api-contract";
import { ApiError, api, isApiError } from "@/lib/api";
import { factCache } from "@/lib/fact-cache";
import type { FactState } from "./types";

const EMPTY: FactState = {
  fact: null,
  fromCache: false,
  isLoading: false,
  error: null,
};

/**
 * Requests in flight, keyed by user + movie. A second caller for the same key
 * (React StrictMode's double-mounted effect in dev, or a double click) shares
 * the first request instead of triggering another OpenAI call.
 */
const inflight = new Map<string, Promise<Fact>>();

function fetchFactDeduped(userId: string, movie: string): Promise<Fact> {
  const key = `${userId}\u0000${movie}`;
  let promise = inflight.get(key);
  if (!promise) {
    promise = api.generateFact().finally(() => inflight.delete(key));
    inflight.set(key, promise);
  }
  return promise;
}

/**
 * Loads a fun fact for `movie`, using the 30s client cache.
 *
 * - `movie === null` pauses the hook: nothing is shown or fetched. The
 *   dashboard passes null while a movie edit is being saved, because
 *   POST /api/fact uses the movie *stored on the server*, so fetching
 *   mid-save could return a fact about the old title.
 * - `refresh()` is the explicit "new fact" action and bypasses the cache.
 * - Responses that arrive after the movie changed (or after a newer request
 *   started) are ignored, so a slow response can't overwrite a newer one.
 */
export function useFact(userId: string, movie: string | null) {
  const router = useRouter();
  const [state, setState] = useState<FactState>(() => ({
    ...EMPTY,
    isLoading: movie !== null,
  }));

  // Incremented on every new request and on cleanup. A response is applied only if its id is still the latest.
  const latestRequest = useRef(0);

  const load = useCallback(
    async (force: boolean) => {
      if (movie === null) return;

      if (!force) {
        const hit = factCache.get(userId, movie);
        if (hit) {
          latestRequest.current++; // supersedes any in-flight requests
          setState({ ...EMPTY, fact: hit.fact, fromCache: true });
          return;
        }
      }

      const requestId = ++latestRequest.current;
      setState((prev) => ({
        ...prev,
        // Keep showing the current fact while refreshing, but only if it's about the currently chosen movie.
        fact: prev.fact?.movie === movie ? prev.fact : null,
        isLoading: true,
        error: null,
      }));

      try {
        const fact = await fetchFactDeduped(userId, movie);
        if (requestId !== latestRequest.current) return; // stale

        if (fact.movie !== movie) {
          // In this case, the server generated a fact for a different movie, so the favorite was changed elsewhere (e.g. another tab). Don't cache it.
          throw new ApiError(
            409,
            "MOVIE_OUT_OF_SYNC",
            "Your favorite movie was changed somewhere else. Refresh the page to sync.",
          );
        }

        factCache.set(userId, fact);
        setState({ ...EMPTY, fact });
      } catch (err) {
        if (requestId !== latestRequest.current) return; // stale
        const error = isApiError(err)
          ? err
          : new ApiError(0, "INTERNAL_ERROR", "Something went wrong.");
        if (error.code === "UNAUTHORIZED") {
          router.replace("/");
          return;
        }
        setState((prev) => ({ ...prev, isLoading: false, error }));
      }
    },
    [userId, movie, router],
  );

  useEffect(() => {
    if (movie === null) {
      setState(EMPTY);
    } else {
      void load(false);
    }
    // On movie change or unmount, invalidate any in-flight requests.
    return () => {
      latestRequest.current++; // eslint-disable-line react-hooks/exhaustive-deps
    };
  }, [movie, load]);

  const refresh = useCallback(() => void load(true), [load]);

  return { ...state, refresh };
}
