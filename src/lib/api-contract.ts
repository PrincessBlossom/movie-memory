/**
 * The API contract: one place that defines what every endpoint returns.
 *
 * Shared by the route handlers (which build responses of these types) and by
 * the client in `lib/api.ts` (which validates responses against these schemas
 * at runtime). Server and client can't silently drift apart: a mismatch fails
 * typecheck on the server, or parsing on the client.
 *
 * This file must stay importable from client code: no Prisma, no secrets.
 *
 * Endpoints
 *   GET  /api/me        → 200 MeResponse          | 401
 *   PUT  /api/me/movie  → 200 UpdateMovieResponse | 400, 401
 *   GET  /api/fact      → 200 FactResponse        | 401, 409, 429, 502
 *
 * Every non-2xx response has the same shape: ApiErrorBody.
 */
import { z } from "zod";
import { movieTitleSchema } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const API_ERROR_CODES = [
  "UNAUTHORIZED", // 401: no valid session
  "VALIDATION_ERROR", // 400: bad request body
  "NO_FAVORITE_MOVIE", // 409: fact requested before onboarding
  "RATE_LIMITED", // 429: per-user fact limit, or OpenAI's own rate limit
  "FACT_GENERATION_FAILED", // 502: OpenAI failed or timed out
  "INTERNAL_ERROR", // 500: anything unexpected
  // Client-only codes, produced in the browser, never sent by the server:
  "NETWORK_ERROR", // request never got a response (offline, timeout)
  "INVALID_RESPONSE", // response didn't match the contract
  "MOVIE_OUT_OF_SYNC", // fact came back for a different movie (changed in another tab)
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

/** The signed-in user, as the client sees them. Name/email/image may be missing. */
export const meSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  favoriteMovie: z.string().nullable(),
});
export type Me = z.infer<typeof meSchema>;

export const factSchema = z.object({
  id: z.string(),
  /** Snapshot of the movie this fact is about (may differ from the current favorite). */
  movie: z.string(),
  content: z.string(),
  /** ISO 8601 timestamp. */
  createdAt: z.string(),
});
export type Fact = z.infer<typeof factSchema>;

// ---------------------------------------------------------------------------
// Requests & responses
// ---------------------------------------------------------------------------

export const meResponseSchema = z.object({ user: meSchema });
export type MeResponse = z.infer<typeof meResponseSchema>;

/** PUT /api/me/movie body. Same validation rules as onboarding. */
export const updateMovieRequestSchema = z.object({ movie: movieTitleSchema });
export type UpdateMovieRequest = z.input<typeof updateMovieRequestSchema>;

/** Returns the saved (trimmed) title, which the client treats as the source of truth. */
export const updateMovieResponseSchema = z.object({ favoriteMovie: z.string() });
export type UpdateMovieResponse = z.infer<typeof updateMovieResponseSchema>;

export const factResponseSchema = z.object({ fact: factSchema });
export type FactResponse = z.infer<typeof factResponseSchema>;
