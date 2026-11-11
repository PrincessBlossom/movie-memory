// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  generateMovieFact: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { fact: { findMany: mocks.findMany, create: mocks.create } },
}));
vi.mock("@/lib/openai", () => ({ generateMovieFact: mocks.generateMovieFact }));

import { FACT_RATE_LIMIT, FactRateLimitError, createFactForUser } from "./facts";

/** findMany is called twice per generation: [recent (rate limit), previous (no-repeat)]. */
function mockReads(recent: { createdAt: Date }[], previous: { content: string }[] = []) {
  mocks.findMany.mockImplementation(async (args: { where: { movie?: string } }) =>
    args.where.movie ? previous : recent,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockReads([]);
  mocks.generateMovieFact.mockImplementation(async () => {
    await new Promise((r) => setTimeout(r, 10)); // OpenAI takes a while
    return "A fact.";
  });
  mocks.create.mockImplementation(async ({ data }) => ({
    id: `fact-${mocks.create.mock.calls.length}`,
    createdAt: new Date(),
    ...data,
  }));
});

describe("createFactForUser", () => {
  it("coalesces 10 concurrent requests into one OpenAI call and one row", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => createFactForUser("u1", "Up")),
    );
    expect(mocks.generateMovieFact).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(new Set(results.map((f) => f.id)).size).toBe(1);
  });

  it("does not coalesce different users", async () => {
    await Promise.all([createFactForUser("u1", "Up"), createFactForUser("u2", "Up")]);
    expect(mocks.generateMovieFact).toHaveBeenCalledTimes(2);
  });

  it("rejects with a retry-after once the per-user limit is reached, without calling OpenAI", async () => {
    const now = Date.now();
    const oldest = new Date(now - 45_000); // frees up in ~15s
    mockReads([
      { createdAt: oldest },
      ...Array.from({ length: FACT_RATE_LIMIT.max - 1 }, () => ({ createdAt: new Date(now) })),
    ]);

    const err = await createFactForUser("u1", "Up").catch((e) => e);
    expect(err).toBeInstanceOf(FactRateLimitError);
    expect(err.retryAfterSeconds).toBeGreaterThanOrEqual(14);
    expect(err.retryAfterSeconds).toBeLessThanOrEqual(16);
    expect(mocks.generateMovieFact).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("allows generation just under the limit", async () => {
    mockReads(Array.from({ length: FACT_RATE_LIMIT.max - 1 }, () => ({ createdAt: new Date() })));
    await expect(createFactForUser("u1", "Up")).resolves.toMatchObject({ movie: "Up" });
  });

  it("scopes reads to the user and passes earlier facts to the model to avoid repeats", async () => {
    mockReads([], [{ content: "Old fact 1." }, { content: "Old fact 2." }]);
    await createFactForUser("u1", "Up");

    for (const [args] of mocks.findMany.mock.calls) {
      expect(args.where.userId).toBe("u1");
    }
    expect(mocks.generateMovieFact).toHaveBeenCalledWith("Up", ["Old fact 1.", "Old fact 2."]);
    expect(mocks.create).toHaveBeenCalledWith({
      data: { userId: "u1", movie: "Up", content: "A fact." },
    });
  });

  it("allows a new request after a failed one (no stuck in-flight entry)", async () => {
    mocks.generateMovieFact.mockRejectedValueOnce(new Error("OpenAI down"));
    await expect(createFactForUser("u1", "Up")).rejects.toThrow("OpenAI down");
    await expect(createFactForUser("u1", "Up")).resolves.toMatchObject({ content: "A fact." });
  });
});
