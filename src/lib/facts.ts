import "server-only";
import type { Fact } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateMovieFact } from "@/lib/openai";

/**
 * Per-user limit on fact generation, enforced from the Fact table itself:
 * every successful generation stores a row, so "rows in the last minute" is
 * the request count. No extra table or Redis needed.
 */
export const FACT_RATE_LIMIT = { max: 5, windowMs: 60_000 };

/** How many earlier facts about the same movie are sent to the model to avoid repeats. */
const PREVIOUS_FACTS_FOR_PROMPT = 5;

export class FactRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Fact rate limit exceeded; retry in ${retryAfterSeconds}s`);
    this.name = "FactRateLimitError";
  }
}

/**
 * Generations in progress in this server process, keyed by user + movie.
 * Concurrent requests (a burst of clicks, a script) share one OpenAI call and
 * one stored row instead of each paying for their own.
 */
const inflight = new Map<string, Promise<Fact>>();

/**
 * The last queued generation per user. Generations for one user run one at a
 * time, so each rate-limit check counts the rows of the ones before it.
 * Without this, requests for different movies (which coalescing doesn't
 * merge) could all read the count before any of their rows landed, and all
 * pass.
 */
const userQueue = new Map<string, Promise<unknown>>();

function runSerially<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const previous = userQueue.get(userId) ?? Promise.resolve();
  const run = previous.then(task, task);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  userQueue.set(userId, settled);
  void settled.then(() => {
    if (userQueue.get(userId) === settled) userQueue.delete(userId);
  });
  return run;
}

/**
 * Generate, store and return a new fact about `movie` for this user.
 *
 * Cost protection:
 * 1. Concurrent requests for the same user + movie are coalesced (above).
 * 2. A user's generations run one at a time, and each is allowed only if the
 *    user has fewer than FACT_RATE_LIMIT.max facts in the window, else
 *    FactRateLimitError. Within one process the limit is exact.
 *
 * Limitation: both guards are per server process. Across several instances,
 * concurrent bursts could exceed the limit before rows land. A shared store
 * (Redis, or a Postgres advisory lock) would close that gap.
 *
 * `movie` is stored as a snapshot so facts stay tied to the title they were
 * generated for, even after the user changes their favorite.
 */
export function createFactForUser(userId: string, movie: string): Promise<Fact> {
  const key = `${userId}\u0000${movie}`;
  let promise = inflight.get(key);
  if (!promise) {
    promise = runSerially(userId, () => generateAndStore(userId, movie)).finally(() =>
      inflight.delete(key),
    );
    inflight.set(key, promise);
  }
  return promise;
}

async function generateAndStore(userId: string, movie: string): Promise<Fact> {
  const now = Date.now();
  const windowStart = new Date(now - FACT_RATE_LIMIT.windowMs);

  // Two reads, both scoped to this user and served by the Fact indexes:
  const [recent, previous] = await Promise.all([
    // Rate limit: facts created in the window, oldest first. @@index([userId, createdAt])
    prisma.fact.findMany({
      where: { userId, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      take: FACT_RATE_LIMIT.max,
      select: { createdAt: true },
    }),
    // Variety: the latest facts for this user + movie, so the model can avoid
    // repeating them. @@index([userId, movie, createdAt(sort: Desc)])
    prisma.fact.findMany({
      where: { userId, movie },
      orderBy: { createdAt: "desc" },
      take: PREVIOUS_FACTS_FOR_PROMPT,
      select: { content: true },
    }),
  ]);

  if (recent.length >= FACT_RATE_LIMIT.max) {
    // A slot frees up when the oldest fact in the window ages out.
    const oldest = recent[0]!.createdAt.getTime();
    const retryAfterMs = oldest + FACT_RATE_LIMIT.windowMs - now;
    throw new FactRateLimitError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
  }

  const { content, recognized } = await generateMovieFact(
    movie,
    previous.map((f) => f.content),
  );
  return prisma.fact.create({ data: { userId, movie, content, recognized } });
}

/**
 * The most recent stored fact about `movie` for this user, or null. A plain
 * read: no OpenAI call, no write, no rate limit.
 */
export function getLatestFact(userId: string, movie: string): Promise<Fact | null> {
  return prisma.fact.findFirst({
    where: { userId, movie },
    orderBy: { createdAt: "desc" }, // @@index([userId, movie, createdAt(sort: Desc)])
  });
}
