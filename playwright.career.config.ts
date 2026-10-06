import { defineConfig } from "@playwright/test";

// Isolated UI contract tests: mocked API/auth, no database or production credentials.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "career-flow.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5187", channel: process.env.E2E_BROWSER_CHANNEL || undefined,
    timezoneId: "UTC", locale: "en-CA", trace: "retain-on-failure" },
  outputDir: "test-results/career",
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187 --strictPort --mode devlocal",
    cwd: "../fantasy-curling-frontend",
    url: "http://127.0.0.1:5187",
    reuseExistingServer: false,
    env: { VITE_API_ENV: "devlocal", VITE_SUPABASE_URL: "https://career-test.supabase.co", VITE_SUPABASE_ANON_KEY: "career-test-public-key" },
  },
});
