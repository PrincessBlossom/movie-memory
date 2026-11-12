// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  createFactForUser: vi.fn(),
  getLatestFact: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/facts", async () => {
  const { FactRateLimitError } = await vi.importActual<typeof import("@/lib/facts")>("@/lib/facts");
  return {
    createFactForUser: mocks.createFactForUser,
    getLatestFact: mocks.getLatestFact,
    FactRateLimitError,
  };
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
import { GET, POST } from "./route";

const row = {
  id: "f1",
  userId: "user-1",
  movie: "Up",
  content: "A fact.",
  recognized: true,
  createdAt: new Date("2026-11-11T00:00:00.000Z"),
};
const dto = {
  id: "f1",
  movie: "Up",
  content: "A fact.",
  recognized: true,
  createdAt: "2026-11-11T00:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
  mocks.findUnique.mockResolvedValue({ favoriteMovie: "Up" });
});

describe.each([
  ["GET", GET],
  ["POST", POST],
])("%s /api/fact: auth and onboarding", (_method, handler) => {
  it("401s without a session", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await handler()).status).toBe(401);
    expect(mocks.createFactForUser).not.toHaveBeenCalled();
    expect(mocks.getLatestFact).not.toHaveBeenCalled();
  });

  it("401s when the session's user no longer exists", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect((await handler()).status).toBe(401);
  });

  it("409s before onboarding (no favorite movie)", async () => {
    mocks.findUnique.mockResolvedValue({ favoriteMovie: null });
    const res = await handler();
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("NO_FAVORITE_MOVIE");
  });
});

describe("GET /api/fact (read only)", () => {
  it("returns the latest stored fact for the session user's movie, without generating", async () => {
    mocks.getLatestFact.mockResolvedValue(row);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fact: dto });
    expect(mocks.getLatestFact).toHaveBeenCalledWith("user-1", "Up");
    expect(mocks.createFactForUser).not.toHaveBeenCalled();
  });

  it("returns { fact: null } when there's no stored fact yet", async () => {
    mocks.getLatestFact.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ fact: null });
  });
});

describe("POST /api/fact (generates)", () => {
  it("returns the new fact in the contract shape, generated for the session user's movie", async () => {
    mocks.createFactForUser.mockResolvedValue(row);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fact: dto });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" } }));
    expect(mocks.createFactForUser).toHaveBeenCalledWith("user-1", "Up");
  });

  it("passes through recognized: false for an unidentified title", async () => {
    mocks.createFactForUser.mockResolvedValue({ ...row, recognized: false });
    expect((await (await POST()).json()).fact.recognized).toBe(false);
  });

  it("429s with Retry-After when the per-user limit is hit", async () => {
    mocks.createFactForUser.mockRejectedValue(new FactRateLimitError(12));
    const res = await POST();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
  });

  it("429s when OpenAI itself rate-limits", async () => {
    mocks.createFactForUser.mockRejectedValue(new FactGenerationError("rate_limited" as never));
    expect((await POST()).status).toBe(429);
  });

  it("502s when generation fails", async () => {
    mocks.createFactForUser.mockRejectedValue(new FactGenerationError("failed" as never));
    const res = await POST();
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("FACT_GENERATION_FAILED");
  });
});
