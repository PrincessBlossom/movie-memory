// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { updateMany: mocks.updateMany } } }));

import { PUT } from "./route";

const put = (body: unknown) =>
  PUT(
    new Request("http://localhost/api/me/movie", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("PUT /api/me/movie", () => {
  it("401s without a session and never touches the database", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await put({ movie: "Heat" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "You need to sign in." } });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["blank title", { movie: "   " }],
    ["too long", { movie: "x".repeat(201) }],
    ["wrong type", { movie: 42 }],
    ["missing field", {}],
    ["invalid JSON", "{not json"],
  ])("400s on %s", async (_label, body) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("trims, saves for the session user only, and returns the stored value", async () => {
    // An attacker-supplied userId in the body is ignored.
    const res = await put({ movie: "  Heat  ", userId: "someone-else" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ favoriteMovie: "Heat" });
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { favoriteMovie: "Heat" },
    });
  });
});
