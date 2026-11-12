// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
});

describe("GET /api/me", () => {
  it("401s without a session", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("401s when the session's user no longer exists", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns only contract fields for the session user, with nulls preserved", async () => {
    mocks.findUnique.mockResolvedValue({ name: null, email: "a@b.c", image: null, favoriteMovie: "Up" });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { name: null, email: "a@b.c", image: null, favoriteMovie: "Up" },
    });
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    // Queried by session id with an explicit select, so no other columns can leak.
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { name: true, email: true, image: true, favoriteMovie: true },
    });
  });
});
