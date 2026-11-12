/**
 * Character counter for movie title inputs. Pure and dependency-free (no zod),
 * so the onboarding page can use it without growing its bundle.
 *
 * The inputs have no `maxLength`: the browser would silently stop typing, or
 * cut off a pasted title, at the limit. Instead the counter appears as the
 * title gets close, turns red past the limit, and validation explains the
 * error on submit.
 */
import { MOVIE_MAX_LENGTH } from "@/lib/constants";
import type { LengthHint } from "@/types/length-hint";

/** Show the counter once the title is within this many characters of the limit. */
export const LENGTH_HINT_THRESHOLD = 40;

export function toLengthHint(value: string): LengthHint | null {
  // Validation trims before counting, so the counter does too.
  const length = value.trim().length;
  if (length < MOVIE_MAX_LENGTH - LENGTH_HINT_THRESHOLD) return null;

  const over = length - MOVIE_MAX_LENGTH;
  return {
    text:
      `${length} / ${MOVIE_MAX_LENGTH} characters` +
      (over > 0 ? ` (${over} over the limit)` : ""),
    over: over > 0,
  };
}
