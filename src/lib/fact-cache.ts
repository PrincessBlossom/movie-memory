/**
 * Client-side cache for the last generated fact.
 *
 * Rules (Variant B spec):
 *   - Keep only the most recent fact, with the time it was cached.
 *   - Reuse it for 30s unless the user explicitly asks for a new one.
 *   - Invalidate it when the favorite movie changes.
 *
 * Design:
 *   - Stored in sessionStorage, so a page refresh within 30s reuses the fact
 *     (an in-memory cache would be wiped by the refresh). It's scoped to the
 *     tab and cleared when the tab closes.
 *   - Each entry records the userId and the movie it belongs to. A lookup
 *     only hits if both match, so a fact is never shown for the wrong movie
 *     (even if explicit invalidation were missed) or to a different user who
 *     signs in on the same tab.
 *   - Entries are validated on read. Corrupt or old-format data is a miss,
 *     not a crash.
 *   - Storage and clock are injectable so the TTL logic is unit-testable.
 */
import { z } from "zod";
import { factSchema, type Fact } from "@/lib/api-contract";

export const FACT_CACHE_TTL_MS = 30_000;
const STORAGE_KEY = "movie-memory:last-fact";

const entrySchema = z.object({
  userId: z.string(),
  fact: factSchema,
  cachedAt: z.number(),
});
type Entry = z.infer<typeof entrySchema>;

export type CachedFact = { fact: Fact; cachedAt: number };

/** The subset of the Web Storage API the cache needs. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createFactCache(
  storage: KeyValueStorage,
  now: () => number = Date.now,
) {
  return {
    /** The cached fact for this user and movie if it's younger than the TTL, else null. */
    get(userId: string, movie: string): CachedFact | null {
      let entry: Entry;
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw === null) return null;
        const parsed = entrySchema.safeParse(JSON.parse(raw));
        if (!parsed.success) return null;
        entry = parsed.data;
      } catch {
        return null; // unreadable storage or invalid JSON: treat as a miss
      }

      if (entry.userId !== userId) return null;
      if (entry.fact.movie !== movie) return null;
      if (now() - entry.cachedAt >= FACT_CACHE_TTL_MS) return null;
      return { fact: entry.fact, cachedAt: entry.cachedAt };
    },

    /** Replace the cached fact. Returns the timestamp it was cached at. */
    set(userId: string, fact: Fact): number {
      const cachedAt = now();
      const entry: Entry = { userId, fact, cachedAt };
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(entry));
      } catch {
        // Quota exceeded or storage disabled: caching is best-effort.
      }
      return cachedAt;
    },

    /** Drop the cached fact (movie changed, or user signed out). */
    clear(): void {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
  };
}

export type FactCache = ReturnType<typeof createFactCache>;

/** In-memory fallback for when sessionStorage is unavailable (SSR, disabled storage). */
function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function browserStorage(): KeyValueStorage {
  try {
    // Accessing sessionStorage can throw (e.g. when storage is blocked).
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // fall through
  }
  return memoryStorage();
}

/**
 * App-wide instance. Only use it from effects and event handlers (never during
 * render), so it only ever touches the browser's sessionStorage.
 */
export const factCache = createFactCache(browserStorage());
