import { defineConfig } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv();

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/career-flow.spec.ts", "**/stats-flow.spec.ts"],
  globalSetup: "./scripts/global-setup.ts",
  globalTeardown: "./scripts/global-teardown.ts",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    timezoneId: "UTC",
    locale: "en-CA",
    testIdAttribute: "data-testid"
  },
  outputDir: "test-results/artifacts"
});
