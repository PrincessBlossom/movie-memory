import { z } from "zod";
import { MOVIE_MAX_LENGTH, MOVIE_MIN_LENGTH } from "@/lib/constants";

/**
 * Single source of truth for movie-title validation. Used by the onboarding
 * server action (and later by PUT /api/me/movie), so client and server rules
 * can never disagree. Trimming happens *before* the length checks, so
 * "   " is rejected as empty.
 */
export const movieTitleSchema = z
  .string({ error: "Movie title is required." })
  .trim()
  .min(MOVIE_MIN_LENGTH, { error: "Please enter a movie title." })
  .max(MOVIE_MAX_LENGTH, {
    error: `Movie title must be at most ${MOVIE_MAX_LENGTH} characters.`,
  });
