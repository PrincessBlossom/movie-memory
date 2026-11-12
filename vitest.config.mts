import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside Next's server bundler; tests import
      // server modules (route handlers) directly, so stub it out.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom", // route handler tests opt into "node" per file
    setupFiles: ["./test/setup.ts"],
    restoreMocks: true,
    // Unit and route tests live in test/, mirroring src/. Playwright specs
    // live in e2e/ and run with `npm run test:e2e`.
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
