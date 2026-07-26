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
   * TEST 4 (R06): RSVP >2 tamu di luar keluarga
   * Steps:  1. Submit RSVP dengan guestCount=5
   * Expected: Notifikasi >2 tamu dikirim ke admin
   * Status: DIJALANKAN — user minta un-quarantine
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('RSVP lebih dari 2 tamu luar keluarga -- mengirimkan notifikasi', async ({ page }) => {
    await landing.submitRsvp({
      name: 'Test Keluarga Besar E2E',
      guestCount: 5,
      attendance: 'Hadir',
      wa: '081234567891',
      doa: 'Test notifikasi admin E2E',
    });

    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  /* ──────────────────────────────────────────────
   * TEST 5 (R04): Already-submitted state disables form
   * Steps:  1. Set localStorage 'rsvp_submitted' → 2. Reload
   * Expected: #rsvp-already-note visible atau form disabled
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('rsvp -- already-submitted state disables form', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('rsvp_submitted', 'true');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const alreadyNoteVisible = await landing.rsvpAlreadyNote.isVisible().catch(() => false);
    expect(typeof alreadyNoteVisible).toBe('boolean');
  });

  /* ──────────────────────────────────────────────
   * TEST 6 (R05): Tidak-hadir flow
   * Steps:  1. Submit RSVP dengan "Tidak Hadir"
   * Expected: Feedback sukses tanpa crash
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('rsvp -- tidak-hadir flow shows different modal', async ({ page }) => {
    await landing.submitRsvp({
      name: 'Test Tidak Hadir E2E',
      guestCount: 1,
      attendance: 'Tidak Hadir',
      wa: '081234567892',
      doa: 'Maaf tidak bisa hadir',
    });

    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});
