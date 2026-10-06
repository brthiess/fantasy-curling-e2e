import { defineConfig } from "@playwright/test";
import base from "./playwright.stats.config";

export default defineConfig({ ...base, testMatch: "country-flags.spec.ts", outputDir: "test-results/country-flags" });
