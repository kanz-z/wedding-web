/// <reference types="node" />
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration untuk Wedding Web — Reza & Ashila.
 *
 * Reporter: html + junit + json
 * Artifacts: screenshot only-on-failure, trace on-first-retry, video retain-on-failure
 * Retries: 2 di CI, 0 lokal
 * baseURL: via env BASE_URL, fallback ke production URL
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 3 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],

  use: {
    baseURL:
      process.env.BASE_URL || "https://wedding-web-reza-shila-2026.vercel.app",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  // Tidak ada webServer — test dijalankan terhadap BASE_URL (staging/production)
  // Jika ingin menjalankan lokal, set BASE_URL=http://localhost:5173
});
