import { z } from "zod";
import {
  updateMovieRequestSchema,
  type UpdateMovieResponse,
} from "@/lib/api-contract";
import {
  getSessionUserId,
  jsonError,
  jsonOk,
  unauthorized,
  withErrorHandling,
} from "@/lib/api-server";
import { prisma } from "@/lib/prisma";

/**
 * PUT /api/me/movie: replace the signed-in user's favorite movie.
 *
 * PUT because it's an idempotent full replacement of one field: sending the
 * same body twice leaves the same state. The route is "/me/...", not
 * "/users/:id/...", so there's no id in the URL for a caller to tamper with.
 */
export const PUT = withErrorHandling(async (request: Request) => {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Request body must be JSON.");
  }

  const parsed = updateMovieRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      z.treeifyError(parsed.error).properties?.movie?.errors[0] ??
      "Invalid request body.";
    return jsonError(400, "VALIDATION_ERROR", message);
  }

  // Scoped by the session's user id. updateMany returns a count instead of throwing when the row doesn't exist (e.g. the account was deleted).
  const { count } = await prisma.user.updateMany({
    where: { id: userId },
    data: { favoriteMovie: parsed.data.movie },
  });
  if (count === 0) return unauthorized();

  // Return the normalized (trimmed) value so the client can reconcile its optimistic state with exactly what was stored.
  return jsonOk<UpdateMovieResponse>({ favoriteMovie: parsed.data.movie });
});
