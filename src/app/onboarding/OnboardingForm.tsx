"use client";

import { useActionState } from "react";
import { saveFavoriteMovie, type OnboardingState } from "./actions";
import { MOVIE_MAX_LENGTH } from "@/lib/constants";

const initialState: OnboardingState = { error: null, value: "" };

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    saveFavoriteMovie,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="movie" className="block text-sm font-medium text-slate-700">
        What&apos;s your favorite movie?
      </label>
      {/* maxLength/required are UX hints only — the server action is the
          real validation boundary. */}
      <input
        id="movie"
        name="movie"
        type="text"
        required
        maxLength={MOVIE_MAX_LENGTH}
        defaultValue={state.value}
        placeholder="e.g. Spirited Away"
        aria-invalid={!!state.error}
        aria-describedby={state.error ? "movie-error" : undefined}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      {state.error && (
        <p id="movie-error" role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
