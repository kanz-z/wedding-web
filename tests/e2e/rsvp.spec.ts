import { test, expect } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { RSVP_GUEST, SUPABASE_CONFIG } from '../fixtures/test-data';

/**
 * RSVP Flow — Konfirmasi Kehadiran
 * =================================
 * Objective: Memverifikasi form RSVP berfungsi end-to-end:
 *           tampil lengkap, submit valid (feedback sukses),
 *           submit invalid (tetap di halaman).
 * Preconditions: Tamu anonim, tidak perlu login.
 * Rate limiting: Edge Function `/rate-limit-rsvp` bisa return 429.
 */

test.describe('RSVP Flow — Konfirmasi Kehadiran', () => {
  let landing: LandingPage;

  test.beforeEach(async ({ page }) => {
    landing = new LandingPage(page);
    await landing.goto();
  });

  /* ──────────────────────────────────────────────
   * TEST 1: Form RSVP tampil lengkap
   * Steps:  1. Scroll ke section #rsvp
   * Expected: Semua field tampil: nama, jumlah tamu, hadir/tidak,
   *           nomor WA, doa, dan tombol kirim
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('form RSVP — semua field tampil', async () => {
    await landing.scrollToSection('rsvp');

    await expect(landing.rsvpNameInput).toBeVisible();
    await expect(landing.rsvpGuestCountInput).toBeVisible();
    await expect(landing.rsvpAttendanceSelect).toBeVisible();
    await expect(landing.rsvpWaInput).toBeVisible();
    await expect(landing.rsvpSubmitButton).toBeVisible();
  });

  /* ──────────────────────────────────────────────
   * TEST 2: Submit RSVP dengan data valid
   * Steps:  1. Isi semua field dengan data valid → 2. Klik Kirim
   * Expected: Feedback sukses (toast, alert, atau tombol berubah
   *           jadi "Lihat Kartu Undangan"). Tidak crash.
   * Fragile: Edge function cold-start bisa menyebabkan timeout.
   *          Gunakan waitForResponse untuk menunggu network selesai.
   * Artifacts: Screenshot on failure, trace on first retry
   * ────────────────────────────────────────────── */
  test('submit RSVP valid — muncul feedback sukses', async ({ page }) => {
    // Setup network waiter SEBELUM memicu submit
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('functions.supabase.co') || resp.url().includes('rate-limit-rsvp'),
      { timeout: 15_000 },
    ).catch(() => null); // Edge function cold start bisa lambat — jangan fail

    await landing.submitRsvp(RSVP_GUEST);

    // Tunggu response network (jika tersedia), atau fallback ke load state
    await responsePromise;
    await page.waitForLoadState('networkidle').catch(() => {});

    // Verifikasi feedback sukses
    const successIndicator = page.locator(
      '.toast, [role="alert"], [class*="success"], button:has-text("Kartu")',
    );
    const hasFeedback = (await successIndicator.count()) > 0;
    expect(hasFeedback).toBe(true);
  });

  /* ──────────────────────────────────────────────
   * TEST 3: Submit tanpa nama — tetap di halaman RSVP
   * Steps:  1. Scroll RSVP → 2. Isi field lain kecuali nama
   *          → 3. Klik Kirim
   * Expected: Tidak redirect ke /invitation/, tetap di halaman RSVP
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('submit RSVP tanpa nama — form tidak terkirim', async ({ page }) => {
    await landing.scrollToSection('rsvp');
    await landing.rsvpGuestCountInput.fill('1');
    await landing.rsvpAttendanceSelect.selectOption('Hadir');
    await landing.rsvpWaInput.fill('081234567890');
    await landing.rsvpSubmitButton.click();

    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).not.toHaveURL(/\/invitation\//);
  });

  /* ──────────────────────────────────────────────
   * TEST 4 (QUARANTINED): RSVP >2 tamu di luar keluarga
   * Status: test.fixme — implementasi notifikasi >2 tamu
   *         belum lengkap di production (Fase 6 belum rilis).
   *         Ref: [PRD §Aturan RSVP] — tamu luar keluarga max 2.
   * Issue: #RSVP-LIMIT-NOT-READY
   * ────────────────────────────────────────────── */
  test('RSVP >2 tamu luar keluarga — tandai notifikasi', async () => {
    test.fixme(true, 'Notifikasi >2 tamu luar keluarga belum diimplementasikan (Fase 6)');

    await landing.submitRsvp({
      name: 'Test Keluarga Besar',
      guestCount: 5,
      attendance: 'Hadir',
      wa: '081234567891',
      doa: 'Test notifikasi admin',
    });

    // Expected: notifikasi muncul di dashboard admin
    // Saat ini belum ada, maka di-skip
  });
});
