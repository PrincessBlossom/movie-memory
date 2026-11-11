import type { FactResponse } from "@/lib/api-contract";
import {
  getSessionUserId,
  jsonError,
  jsonOk,
  unauthorized,
} from "@/lib/api-server";
import { createFactForUser, FactRateLimitError } from "@/lib/facts";
import { FactGenerationError } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/fact: generate, store and return a new fun fact about the
 * signed-in user's current favorite movie.
 *
 * Every call generates a new fact. Caching is the client's job in Variant B
 * (see lib/fact-cache.ts). This makes the GET non-idempotent, which is a
 * deliberate tradeoff to match the spec'd endpoint (see README).
 *
 * Cost is bounded server-side (lib/facts.ts): concurrent requests share one
 * generation, and each user gets at most 5 facts per minute.
 */
export async function GET() {
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

  try {
    const fact = await createFactForUser(userId, user.favoriteMovie);
    return jsonOk<FactResponse>({
      fact: {
        id: fact.id,
        movie: fact.movie,
        content: fact.content,
        createdAt: fact.createdAt.toISOString(),
      },
    });
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
