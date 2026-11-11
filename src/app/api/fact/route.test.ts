// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  createFactForUser: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/facts", async () => {
  const { FactRateLimitError } = await vi.importActual<typeof import("@/lib/facts")>("@/lib/facts");
  return { createFactForUser: mocks.createFactForUser, FactRateLimitError };
});
vi.mock("@/lib/openai", () => ({
  FactGenerationError: class FactGenerationError extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  },
}));

import { FactRateLimitError } from "@/lib/facts";
import { FactGenerationError } from "@/lib/openai";
import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
  mocks.findUnique.mockResolvedValue({ favoriteMovie: "Up" });
});

describe("GET /api/fact", () => {
  it("401s without a session", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mocks.createFactForUser).not.toHaveBeenCalled();
  });

  it("409s before onboarding (no favorite movie)", async () => {
    mocks.findUnique.mockResolvedValue({ favoriteMovie: null });
    const res = await GET();
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("NO_FAVORITE_MOVIE");
  });

  it("returns the fact in the contract shape, generated for the session user's movie", async () => {
    mocks.createFactForUser.mockResolvedValue({
      id: "f1",
      userId: "user-1",
      movie: "Up",
      content: "A fact.",
      createdAt: new Date("2026-11-11T00:00:00.000Z"),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      fact: { id: "f1", movie: "Up", content: "A fact.", createdAt: "2026-11-11T00:00:00.000Z" },
    });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" } }));
    expect(mocks.createFactForUser).toHaveBeenCalledWith("user-1", "Up");
  });

  it("429s with Retry-After when the per-user limit is hit", async () => {
    mocks.createFactForUser.mockRejectedValue(new FactRateLimitError(12));
    const res = await GET();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
  });

  it("429s when OpenAI itself rate-limits", async () => {
    mocks.createFactForUser.mockRejectedValue(new FactGenerationError("rate_limited" as never));
    const res = await GET();
    expect(res.status).toBe(429);
  });

  it("502s when generation fails", async () => {
    mocks.createFactForUser.mockRejectedValue(new FactGenerationError("failed" as never));
    const res = await GET();
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("FACT_GENERATION_FAILED");
  });
});
