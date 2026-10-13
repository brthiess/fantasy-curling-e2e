import { defineConfig } from "@playwright/test";
import base from "./playwright.stats.config";
export default defineConfig({ ...base, testMatch: "my-picks-history.spec.ts", outputDir: "test-results/my-picks", timeout: 60_000 });
