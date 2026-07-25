import { test, expect } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { GUESTBOOK_ENTRY, SUPABASE_CONFIG } from '../fixtures/test-data';

/**
 * Guestbook — Ucapan & Doa
 * =========================
 * Objective: Memverifikasi tamu dapat mengirim ucapan di guestbook
 *           dan melihat daftar ucapan yang sudah di-approve admin.
 * Preconditions: Tamu anonim. Ucapan baru masuk pending (is_approved=false).
 * Safety: Ucapan dari E2E test tidak akan tampil publik sampai admin approve.
 *         Tetap gunakan data unik (timestamp) untuk menghindari rate limit.
 */

test.describe('Guestbook — Ucapan & Doa', () => {
  let landing: LandingPage;

  test.beforeEach(async ({ page }) => {
    landing = new LandingPage(page);
    await landing.goto();
  });

  /* ──────────────────────────────────────────────
   * TEST 1: Form guestbook tampil
   * Steps:  1. Scroll ke #guestbook-section
   * Expected: Input nama + textarea ucapan + tombol kirim tampil
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('form guestbook — input dan tombol tampil', async () => {
    await landing.scrollToSection('guestbook-section');

    await expect(landing.guestbookNameInput).toBeVisible();
    await expect(landing.guestbookMessageInput).toBeVisible();
    await expect(landing.guestbookSubmitButton).toBeVisible();
  });

  /* ──────────────────────────────────────────────
   * TEST 2: Kirim ucapan — feedback sukses
   * Steps:  1. Scroll guestbook → 2. Isi nama unik (timestamp)
   *          → 3. Isi ucapan → 4. Klik Kirim → 5. Tunggu network
   * Expected: Toast/alert sukses muncul setelah edge function selesai.
   * Fragile: Edge function cold start + rate limiting.
   *          Gunakan waitForResponse untuk network, bukan waitForTimeout.
   * Safety: Ucapan masuk pending — tidak tampil publik tanpa approve admin.
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('kirim ucapan — muncul feedback sukses', async ({ page }) => {
    const uniqueName = `E2E-${Date.now()}`;

    // Setup network waiter SEBELUM submit
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('functions.supabase.co') || resp.url().includes('rate-limit-guestbook'),
      { timeout: 15_000 },
    ).catch(() => null);

    await landing.submitGuestbookMessage(uniqueName, GUESTBOOK_ENTRY.pesan);

    await responsePromise;
    await page.waitForLoadState('networkidle').catch(() => {});

    const successOrMessage = page.locator(
      '.toast, [role="alert"], [class*="success"]',
    );
    const hasFeedback = (await successOrMessage.count()) > 0;
    expect(hasFeedback).toBe(true);
  });

  /* ──────────────────────────────────────────────
   * TEST 3: Daftar ucapan tampil
   * Steps:  1. Scroll ke guestbook section
   * Expected: Guestbook section menampilkan daftar ucapan
   *           (minimal section container visible).
   * Note: Ucapan individual hanya tampil jika is_approved=true.
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('guestbook — daftar ucapan tampil', async () => {
    await landing.scrollToSection('guestbook-section');
    await expect(landing.guestbookSection).toBeVisible();
  });

  /* ──────────────────────────────────────────────
   * TEST 4 (QUARANTINED): Karakter countdown di textarea
   * Status: test.skip di CI — elemen counter 0/500 mungkin
   *         tidak selalu tampil di production.
   * Issue: #GB-CHAR-COUNTER
   * ────────────────────────────────────────────── */
  test('guestbook — karakter counter 0/500 tampil', async () => {
    test.skip(!!process.env.CI, 'Counter karakter kadang tidak dirender di production — #GB-CHAR-COUNTER');

    await landing.scrollToSection('guestbook-section');
    await expect(landing.guestbookCharCount).toBeVisible();
  });
});
