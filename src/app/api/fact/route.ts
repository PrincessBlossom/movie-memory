import type { Fact as FactRow } from "@prisma/client";
import type { Fact, FactResponse, LatestFactResponse } from "@/lib/api-contract";
import {
  getSessionUserId,
  jsonError,
  jsonOk,
  unauthorized,
} from "@/lib/api-server";
import { createFactForUser, FactRateLimitError, getLatestFact } from "@/lib/facts";
import { FactGenerationError } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

/**
 * /api/fact
 *
 * GET   the latest stored fact about the user's current favorite movie, or
 *       null. Safe and idempotent: no OpenAI call, no write.
 * POST  generate, store and return a new fact. Each call is a paid OpenAI
 *       call and a new row, so it's a POST: browsers, crawlers and prefetchers
 *       never repeat it on their own, and the session cookie (SameSite=Lax)
 *       isn't sent on cross-site POSTs, so another site can't trigger it.
 *
 * Cost is also bounded server-side (lib/facts.ts): concurrent requests share
 * one generation, and each user gets at most 5 facts per minute.
 */

type Movie = { userId: string; movie: string };

/** The session user and their favorite movie, or the error response to return. */
async function resolveMovie(): Promise<Movie | Response> {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { favoriteMovie: true },
  });
  if (!user) return unauthorized();
  if (user.favoriteMovie === null) {
    return jsonError(
      409,
      "NO_FAVORITE_MOVIE",
      "Set a favorite movie before requesting a fact.",
    );
  }
  return { userId, movie: user.favoriteMovie };
}

function toDto(fact: FactRow): Fact {
  return {
    id: fact.id,
    movie: fact.movie,
    content: fact.content,
    recognized: fact.recognized,
    createdAt: fact.createdAt.toISOString(),
  };
}

export async function GET() {
  const resolved = await resolveMovie();
  if (resolved instanceof Response) return resolved;

  const fact = await getLatestFact(resolved.userId, resolved.movie);
  return jsonOk<LatestFactResponse>({ fact: fact && toDto(fact) });
}

export async function POST() {
  const resolved = await resolveMovie();
  if (resolved instanceof Response) return resolved;

  try {
    const fact = await createFactForUser(resolved.userId, resolved.movie);
    return jsonOk<FactResponse>({ fact: toDto(fact) });
  } catch (err) {
    if (err instanceof FactRateLimitError) {
      return jsonError(
        429,
        "RATE_LIMITED",
        `You've asked for a lot of facts. Try again in ${err.retryAfterSeconds}s.`,
        { "Retry-After": String(err.retryAfterSeconds) },
      );
    }
    console.error("Fact generation failed", err);
    if (err instanceof FactGenerationError && err.reason === "rate_limited") {
      return jsonError(
        429,
        "RATE_LIMITED",
        "Too many fact requests. Please wait a minute and try again.",
      );
    }
    return jsonError(
      502,
      "FACT_GENERATION_FAILED",
      "Couldn't generate a fact right now. Please try again.",
    );
  }
}
