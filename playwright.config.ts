import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The test process seeds and inspects the database directly, so it needs the
// same DATABASE_URL as the app. Next loads .env for the server by itself.
if (existsSync(".env")) process.loadEnvFile(".env");

const PORT = 3000;
const MOCK_OPENAI_PORT = 3199;

export default defineConfig({
  testDir: "./e2e",
  // One flow against a shared real database: keep it serial and deterministic.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 }, // first visit to each page compiles it in dev
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/mock-openai.mjs",
      url: `http://127.0.0.1:${MOCK_OPENAI_PORT}/health`,
      env: { MOCK_OPENAI_PORT: String(MOCK_OPENAI_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `npx next dev --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      // Never reuse a running `npm run dev`: it would call the real OpenAI.
      // If port 3000 is busy, Playwright fails fast and says so.
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        OPENAI_BASE_URL: `http://127.0.0.1:${MOCK_OPENAI_PORT}/v1`,
        // A fake key, so a misrouted request fails instead of costing money.
        OPENAI_API_KEY: "e2e-fake-key",
      },
    },
  ],
});
