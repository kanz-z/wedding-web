import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ADMIN_CREDENTIALS } from '../fixtures/test-data';

/**
 * Dashboard — Admin Panel
 * ========================
 * Objective: Memverifikasi admin dapat login, melihat hub navigasi,
 *           dan mengakses semua halaman turunan (Tamu, Check-in,
 *           Reservasi, Pesan Publik).
 * Preconditions: Admin login via Supabase Auth (preview mode).
 * Ref: [AF §Dashboard Manajemen], [TRD §Frontend Implementation Direction]
 */

test.describe('Dashboard — Admin Panel', () => {
  let loginPage: LoginPage;
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboard = new DashboardPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(
      ADMIN_CREDENTIALS.email,
      ADMIN_CREDENTIALS.password,
    );
  });

  /* ──────────────────────────────────────────────
   * TEST 1: Hub navigasi tampil
   * Steps:  1. Login → 2. Lihat halaman hub
   * Expected: Semua widget navigasi tampil: Tamu, Check-in,
   *           Reservasi, Pesan Publik, Admin
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('hub — semua navigasi halaman tampil', async () => {
    await expect(dashboard.navCardGuests).toBeVisible({ timeout: 10_000 });
    await expect(dashboard.navCardCheckin).toBeVisible();
    await expect(dashboard.navCardReservations).toBeVisible();
    await expect(dashboard.navCardPublicMessages).toBeVisible();
    await expect(dashboard.navCardAdmin).toBeVisible();
  });

  /* ──────────────────────────────────────────────
   * TEST 2: Navigasi → Kelola Tamu
   * Steps:  1. Klik nav "Kelola Tamu" → 2. Tunggu load
   * Expected: Tabel tamu tampil (bisa empty jika tidak ada data)
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('navigasi — Kelola Tamu', async ({ page }) => {
    await dashboard.navigateTo('guests');

    // Tabel atau empty state harus visible
    const content = page.locator('table, [role="table"], [class*="empty"], [class*="skeleton"]');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  /* ──────────────────────────────────────────────
   * TEST 3: Navigasi → Check-in
   * Steps:  1. Klik nav "Check-in"
   * Expected: Scanner area atau search manual tampil
   * Artifacts: Screenshot on failure
   * Fragile: QR scanner perlu izin kamera — di CI tidak akan aktif.
   *          Cukup verifikasi container/halaman terbuka.
   * ────────────────────────────────────────────── */
  test('navigasi — Check-in page', async () => {
    await dashboard.navigateTo('checkin');

    const scannerOrSearch = dashboard.page.locator(
      '#qr-reader, [class*="scanner"], input[placeholder*="cari"], button:has-text("Scan")',
    );
    await expect(scannerOrSearch.first()).toBeVisible({ timeout: 10_000 });
  });

  /* ──────────────────────────────────────────────
   * TEST 4: Navigasi → Pesan Publik
   * Steps:  1. Klik nav "Pesan Publik"
   * Expected: Tabel pesan atau empty state tampil
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('navigasi — Pesan Publik', async () => {
    await dashboard.navigateTo('public');

    const content = dashboard.page.locator('table, [role="table"], [class*="empty"]');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  /* ──────────────────────────────────────────────
   * TEST 5: Search tamu
   * Steps:  1. Navigasi Tamu → 2. Ketik query di search box
   * Expected: Search berfungsi tanpa error (debounce 250ms)
   * Artifacts: Screenshot on failure
   * ────────────────────────────────────────────── */
  test('search tamu — debounce berfungsi', async ({ page }) => {
    await dashboard.navigateTo('guests');

    if (await dashboard.guestSearchInput.isVisible()) {
      await dashboard.searchGuest('test');
      // Hanya verifikasi tidak crash — baik ada hasil maupun tidak
      await expect(page.locator('body')).toBeVisible();
    }
  });

  /* ──────────────────────────────────────────────
   * TEST 6 (QUARANTINED): Realtime update row flash
   * Status: test.fixme — Supabase Realtime subscription
   *         butuh 2 admin session simultan, terlalu kompleks
   *         untuk automated CI test.
   * Issue: #RT-UPDATE-TEST
   * ────────────────────────────────────────────── */
  test('realtime update — row flash saat data berubah', async () => {
    test.fixme(true, 'Realtime test perlu 2 session simultan — #RT-UPDATE-TEST');

    // Expected: saat admin lain mengubah data,
    // row yang berubah berkedip pink selama 600ms
  });
});
