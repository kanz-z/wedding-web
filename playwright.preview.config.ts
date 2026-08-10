import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Config khusus verifikasi hasil build lokal (`vite preview`, port 4173).
 *
 * `npm run build` wajib dijalankan sebelum test — `vite preview` hanya
 * menyajikan `dist/` yang sudah ada.
 *
 * Mengujikan origin lokal (localhost:4173) — Supabase/DB tetap sama dengan
 * environment yang dikonfigurasi di `.env` (biasanya production).
 */
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://localhost:4173" },
  webServer: {
    command: "npm run preview",
    port: 4173,
    reuseExistingServer: true,
  },
});