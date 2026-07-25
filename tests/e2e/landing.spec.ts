import { test, expect } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';

/**
 * Landing Page — Undangan Publik
 * =================================
 * Objective: Memverifikasi seluruh section halaman undangan tampil dan
 *            navigasi bottom-tab berfungsi untuk tamu tanpa autentikasi.
 * Preconditions: Tidak ada (anonim, tanpa login).
 */

test.describe('Landing Page — Undangan Publik', () => {
  let landing: LandingPage;

  test.beforeEach(async ({ page }) => {
    landing = new LandingPage(page);
    await landing.goto();
  });

  /* ──────────────────────────────────────────────
   * TEST 1: Cover
   * Steps:  1. Buka halaman utama
   * Expected: Nama pasangan "Reza & Ashila", link "Lihat Undangan",
   *           dan greeting heading "Dear" tampil.
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('cover — menampilkan nama pasangan dan link undangan', async () => {
    await expect(landing.coupleName).toBeVisible();
    await expect(landing.lihatUndanganLink).toBeVisible();
    await expect(landing.greetingHeading).toBeVisible();
  });

  /* ──────────────────────────────────────────────
   * TEST 2: Klik "Lihat Undangan"
   * Steps:  1. Buka halaman utama → 2. Klik "Lihat Undangan"
   * Expected: URL berubah ke #welcome (section Beranda)
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('klik "Lihat Undangan" — scroll ke section Beranda', async ({ page }) => {
    await landing.lihatUndanganLink.click();
    // Tunggu AOS animation selesai (400ms) + buffer 200ms
    // Tidak bisa pakai waitForResponse karena ini anchor scroll murni (no network)
    await page.waitForTimeout(600);

    await expect(page).toHaveURL(/#welcome/);
  });

  /* ──────────────────────────────────────────────
   * TEST 3: Bottom-tab navigasi
   * Steps:  1. Klik tab RSVP → 2. Klik tab Guestbook → 3. Klik tab Gifts
   * Expected: Setiap klik mengubah URL ke anchor section yang benar
   *           dan section target menjadi visible.
   * Artifacts: Screenshot on failure
   * Fragile selector note: Anchor href bisa berubah jika section ID diganti.
   *                         Update di LandingPage.ts jika perlu.
   * ────────────────────────────────────────────── */
  test('bottom-tab navigasi — tiap tab scroll ke section benar', async ({ page }) => {
    await landing.navRsvp.click();
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/#rsvp/);
    await expect(landing.rsvpSection).toBeVisible();

    await landing.navGuestbook.click();
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/#guestbook-section/);
    await expect(landing.guestbookSection).toBeVisible();

    await landing.navGifts.click();
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/#gifts/);
    await expect(landing.giftsSection).toBeVisible();
  });

  /* ──────────────────────────────────────────────
   * TEST 4: Section Acara
   * Steps:  1. Scroll ke section info → 2. Cek maps iframe/link
   * Expected: Google Maps embed iframe ATAU link eksternal maps tampil
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('section Acara — menampilkan Google Maps', async () => {
    await landing.scrollToSection('info');

    const mapLink = landing.page.locator('a[href*="maps.app.goo.gl"], a[href*="google.com/maps"]');
    const mapIframe = landing.page.locator('iframe[src*="google.com/maps"], iframe[src*="maps"]');
    const hasMap = (await mapLink.count()) > 0 || (await mapIframe.count()) > 0;
    expect(hasMap).toBe(true);
  });

  /* ──────────────────────────────────────────────
   * TEST 5: Countdown
   * Steps:  1. Scroll ke section countdown → 2. Cek teks "days"
   * Expected: Countdown menampilkan label hari (days)
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('countdown section — tampil angka days/hours', async () => {
    await landing.scrollToSection('cd');
    await expect(landing.page.getByText(/days/).first()).toBeVisible({ timeout: 5000 });
  });

  /* ──────────────────────────────────────────────
   * TEST 6: Guestbook form tampil
   * Steps:  1. Scroll ke guestbook section → 2. Cek form input
   * Expected: Input nama + input ucapan + tombol submit tampil
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('guestbook — form ucapan tampil', async () => {
    await landing.scrollToSection('guestbook-section');
    await expect(landing.guestbookNameInput).toBeVisible();
    await expect(landing.guestbookSubmitButton).toBeVisible();
  });
});
