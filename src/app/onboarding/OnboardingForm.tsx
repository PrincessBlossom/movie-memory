"use client";

import { useActionState, useState } from "react";
import { TitleLengthHint } from "@/titlelength/TitleLengthHint";
import { toLengthHint } from "@/lib/title-length";
import type { OnboardingAction, OnboardingState } from "./types";

const initialState: OnboardingState = { error: null };

/**
 * The onboarding form. The page passes in the server action, which does the
 * validation and the save; this component only renders the field, the
 * returned error and the pending state.
 */
export function OnboardingForm({ action }: { action: OnboardingAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  // Controlled so the character counter can follow it. Being controlled also keeps what was typed when React resets the form after a failed submit.
  const [value, setValue] = useState("");
  const lengthHint = toLengthHint(value);

  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="movie" className="block text-sm font-semibold text-ink">
        Favorite movie
      </label>
      <input
        id="movie"
        name="movie"
        type="text"
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Spirited Away"
        aria-invalid={!!state.error || lengthHint?.over === true}
        aria-describedby={
          [state.error && "movie-error", lengthHint && "movie-length"]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className="w-full rounded-lg border border-ink/20 bg-white px-4 py-2 transition-colors duration-[750ms] focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
      />
      {lengthHint && <TitleLengthHint id="movie-length" hint={lengthHint} />}
      {state.error && (
        <p id="movie-error" role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-lg bg-brand px-4 py-2 font-semibold text-white transition-colors duration-[750ms] hover:bg-ink disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
