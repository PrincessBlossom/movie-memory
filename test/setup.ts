import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Route handlers read cookies (lib/auth-session.ts), which needs a Next request
// scope. Default to a request with no cookies; tests can override the mock.
vi.mock("next/headers", () => ({
  cookies: async () => ({ has: () => false }),
}));

afterEach(() => {
  cleanup();
  // Route handler tests run in the "node" environment, which has no window.
  if (typeof window !== "undefined") window.sessionStorage.clear();
});
