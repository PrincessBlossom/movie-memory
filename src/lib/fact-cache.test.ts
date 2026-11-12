import { describe, expect, it } from "vitest";
import type { Fact } from "@/lib/api-contract";
import { FACT_CACHE_TTL_MS, createFactCache, type KeyValueStorage } from "@/lib/fact-cache";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const fact = (movie: string): Fact => ({
  id: "f1",
  movie,
  content: `A fact about ${movie}`,
  recognized: true,
  createdAt: "2026-01-01T00:00:00.000Z",
});

function setup() {
  let time = 1_000_000;
  const storage = memoryStorage();
  const cache = createFactCache(storage, () => time);
  return { cache, storage, advance: (ms: number) => (time += ms) };
}

describe("fact cache", () => {
  it("returns the cached fact within the TTL", () => {
    const { cache, advance } = setup();
    cache.set("u1", fact("Up"));
    advance(FACT_CACHE_TTL_MS - 1);
    expect(cache.get("u1", "Up")?.fact).toEqual(fact("Up"));
  });

  it("misses once the TTL has elapsed", () => {
    const { cache, advance } = setup();
    cache.set("u1", fact("Up"));
    advance(FACT_CACHE_TTL_MS);
    expect(cache.get("u1", "Up")).toBeNull();
  });

  it("misses when the movie has changed, even without explicit invalidation", () => {
    const { cache } = setup();
    cache.set("u1", fact("Up"));
    expect(cache.get("u1", "Heat")).toBeNull();
  });

  it("never serves one user's fact to another user", () => {
    const { cache } = setup();
    cache.set("u1", fact("Up"));
    expect(cache.get("u2", "Up")).toBeNull();
  });

  it("clear() invalidates the entry", () => {
    const { cache } = setup();
    cache.set("u1", fact("Up"));
    cache.clear();
    expect(cache.get("u1", "Up")).toBeNull();
  });

  it("only keeps the last fact", () => {
    const { cache } = setup();
    cache.set("u1", fact("Up"));
    cache.set("u1", fact("Heat"));
    expect(cache.get("u1", "Up")).toBeNull();
    expect(cache.get("u1", "Heat")?.fact.movie).toBe("Heat");
  });

  it("treats corrupt storage as a miss instead of throwing", () => {
    const { cache, storage } = setup();
    storage.data.set("movie-memory:last-fact", "{not json");
    expect(cache.get("u1", "Up")).toBeNull();
    storage.data.set("movie-memory:last-fact", JSON.stringify({ userId: "u1" }));
    expect(cache.get("u1", "Up")).toBeNull();
  });
});
