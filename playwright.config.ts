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
    baseURL: process.env.BASE_URL || "https://rezashila2026.vercel.app",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // === Auth setup (sekali, sebelum semua test) ===
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      testDir: "./tests",
      use: { ...devices["Desktop Chrome"] },
    },

    // === Dashboard: 1 browser, reuse auth state ===
    {
      name: "dashboard",
      testMatch: [
        "hub.spec.ts",
        "guests.spec.ts",
        "reservations.spec.ts",
        "checkin.spec.ts",
        "public-messages.spec.ts",
        "private-messages.spec.ts",
        "admin-management.spec.ts",
        "dashboard.spec.ts",
        "auth/login.spec.ts",
        "roles.spec.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/admin-state.json",
      },
      dependencies: ["setup"],
    },

    // === Publik: 4 browser (UX tamu — cross-browser dibutuhkan) ===
    {
      name: "chromium",
      testMatch: [
        "landing.spec.ts",
        "rsvp.spec.ts",
        "guestbook.spec.ts",
        "card.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: [
        "landing.spec.ts",
        "rsvp.spec.ts",
        "guestbook.spec.ts",
        "card.spec.ts",
      ],
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: [
        "landing.spec.ts",
        "rsvp.spec.ts",
        "guestbook.spec.ts",
        "card.spec.ts",
      ],
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      testMatch: [
        "landing.spec.ts",
        "rsvp.spec.ts",
        "guestbook.spec.ts",
        "card.spec.ts",
      ],
      use: { ...devices["Pixel 5"] },
    },
  ],

  // Tidak ada webServer — test dijalankan terhadap BASE_URL (staging/production)
  // Jika ingin menjalankan lokal, set BASE_URL=http://localhost:5173
});
