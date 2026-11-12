// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  queryRaw: vi.fn(),
  cookieNames: [] as string[],
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.queryRaw } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ has: (name: string) => mocks.cookieNames.includes(name) }),
}));

import { getSession } from "@/lib/auth-session";

beforeEach(() => {
  mocks.auth.mockReset();
  mocks.queryRaw.mockReset();
  mocks.cookieNames = [];
});

describe("getSession", () => {
  it("returns a valid session without touching the database again", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1" } });
    await expect(getSession()).resolves.toEqual({ user: { id: "u1" } });
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("returns null without a database check when there is no session cookie", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(getSession()).resolves.toBeNull();
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("returns null for an invalid session cookie when the database is up", async () => {
    mocks.auth.mockResolvedValue(null);
    mocks.cookieNames = ["authjs.session-token"];
    mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    await expect(getSession()).resolves.toBeNull();
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });

  it("throws when the session lookup failed because the database is down", async () => {
    mocks.auth.mockResolvedValue(null); // Auth.js swallowed the adapter error
    mocks.cookieNames = ["__Secure-authjs.session-token"];
    mocks.queryRaw.mockRejectedValue(new Error("Can't reach database server"));
    await expect(getSession()).rejects.toThrow("Can't reach database server");
  });
});
