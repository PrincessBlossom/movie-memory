import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // Route handler tests run in the "node" environment, which has no window.
  if (typeof window !== "undefined") window.sessionStorage.clear();
});
