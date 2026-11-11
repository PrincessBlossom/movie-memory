import "server-only";
import type { Fact } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateMovieFact } from "@/lib/openai";

/**
 * Base implementation: generate a fresh fact on every call and persist it.
 *
 * `movie` is stored as a snapshot so facts stay tied to the title they were
 * generated for, even after the user changes their favorite.
 */
export async function createFactForUser(
  userId: string,
  movie: string,
): Promise<Fact> {
  const content = await generateMovieFact(movie);
  return prisma.fact.create({ data: { userId, movie, content } });
}
