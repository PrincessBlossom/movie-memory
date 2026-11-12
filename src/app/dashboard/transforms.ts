/**
 * Pure functions that turn API data and shell state into what components render.
 * Each is unit-tested on its own
 * (transforms.test.ts).
 */
import type { ApiError } from "@/lib/api";
import type { Fact } from "@/lib/api-contract";
import { movieTitleSchema } from "@/lib/validation";
export { toLengthHint } from "@/lib/title-length";
import type {
  DashboardUser,
  DraftCheck,
  FactCardView,
  FactState,
  ProfileView,
} from "./types";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** Google may omit the name and/or photo; fall back to the email, then a placeholder. */
export function toProfileView(user: DashboardUser): ProfileView {
  return {
    displayName: user.name ?? user.email ?? "there",
    email: user.email,
    image: user.image,
    initials: toInitials(user.name ?? user.email ?? ""),
  };
}

/** "William Tux" → "WT", "billyboithetux@gmail.com" → "B", "" → "?". */
export function toInitials(source: string): string {
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]!.toUpperCase());
  return letters.join("") || "?";
}

// ---------------------------------------------------------------------------
// Movie editor
// ---------------------------------------------------------------------------

/**
 * Check the draft before any request, with the same zod schema the server uses (the server still re-validates). An unchanged title needs no request.
 */
export function validateMovieDraft(draft: string, currentMovie: string): DraftCheck {
  const parsed = movieTitleSchema.safeParse(draft);
  if (!parsed.success) {
    return { kind: "invalid", error: parsed.error.issues[0]?.message ?? "Invalid movie title." };
  }
  if (parsed.data === currentMovie) return { kind: "unchanged" };
  return { kind: "valid", title: parsed.data };
}

/**
 * Map a failed save back onto the movie field. Server messages are already user-safe (VALIDATION_ERROR carries the field's message). Null means "don't reopen the editor". An expired session redirects.
 */
export function toSaveFieldError(error: ApiError): string | null {
  return error.code === "UNAUTHORIZED" ? null : error.message;
}

// ---------------------------------------------------------------------------
// Fact card
// ---------------------------------------------------------------------------

/** Decide which state the fact card is in, and format what it shows. */
export function toFactCardView(state: FactState, isWaitingForMovie: boolean): FactCardView {
  const { fact, fromCache, isLoading, error } = state;
  return {
    body: isWaitingForMovie
      ? { kind: "waiting", message: "Saving your new movie. A fresh fact is on its way!" }
      : fact
        ? {
            kind: "fact",
            content: fact.content,
            meta: toFactMeta(fact, fromCache),
            notice: fact.recognized ? null : toUnrecognizedNotice(fact.movie),
            dimmed: isLoading,
          }
        : isLoading
          ? { kind: "loading" }
          : error
            ? { kind: "none" }
            : { kind: "empty", message: "No fact yet. Click “New fact” to get one." },
    error: error && !isWaitingForMovie ? error.message : null,
    busy: isLoading || isWaitingForMovie,
    refreshLabel: isLoading ? "Generating…" : "New fact",
  };
}

/** "Generated 3:04 PM", plus " · from cache" when it came from the 30s cache. */
export function toFactMeta(fact: Pick<Fact, "createdAt">, fromCache: boolean): string {
  const time = new Date(fact.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Generated ${time}${fromCache ? " · from cache" : ""}`;
}

/** Shown above a fact the model generated for a title it couldn't identify. */
export function toUnrecognizedNotice(movie: string): string {
  return (
    `We couldn't find a movie called “${movie}”. Here's a fact about a similar ` +
    "film instead. Adding the year of your movie, or checking the spelling, can help."
  );
}
