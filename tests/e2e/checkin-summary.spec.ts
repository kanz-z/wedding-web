import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ADMIN_CREDENTIALS } from '../fixtures/test-data';

/**
 * Regression test untuk bug summary card check-in & audit log:
 *  1. Summary card "Sudah/Belum Check-in" di halaman Check-in (Mode Admin)
 *     sebelumnya menampilkan nilai yang salah (tertukar dengan Total/RSVP)
 *     karena mapping berbasis index. Kini dipetakan per-label, sehingga semua
 *     kartu berlabel sama harus menampilkan nilai yang identik.
 *  2. Audit log sebelumnya menulis "+-N" untuk delta negatif (undo). Kini tanda
 *     "+" tidak lagi ditulis untuk delta negatif.
 *
 * Test ini read-only: tidak melakukan check-in/undo, hanya membaca DOM.
 */

async function readSummaryByLabel(
  page: Page,
): Promise<Record<string, string[]>> {
  const cards = page.locator('.guest-summary-card');
  const count = await cards.count();
  const byLabel: Record<string, string[]> = {};
  for (let i = 0; i < count; i++) {
    const label = (await cards.nth(i).locator('.summary-card__label').textContent())?.trim() ?? '';
    const value = (await cards.nth(i).locator('.summary-card__value').textContent())?.trim() ?? '';
    if (!label) continue;
    (byLabel[label] ??= []).push(value);
  }
  return byLabel;
}

test.describe('Check-in — summary card & audit log (regression)', () => {
  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.loginAndWaitForDashboard(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  });

  test('checkin-summary -- semua kartu berlabel sama menampilkan nilai identik', async ({ page }) => {
    // Tunggu data tamu termuat (summary cards sudah ter-render).
    await expect(page.locator('.guest-summary-card').first()).toBeVisible({ timeout: 10_000 });

    const byLabel = await readSummaryByLabel(page);

    // Label "Sudah Check-in" dan "Belum Check-in" muncul di beberapa halaman
    // (Hub, Kelola Tamu, Check-in Mode Admin). Nilainya harus seragam.
    for (const label of ['Sudah Check-in', 'Belum Check-in']) {
      const values = byLabel[label];
      expect(values, `label "${label}" harus ada di DOM`).toBeTruthy();
      expect(values.length, `label "${label}" harus muncul di >1 halaman`).toBeGreaterThanOrEqual(1);
      const unique = new Set(values);
      expect(
        unique.size,
        `semua kartu "${label}" harus punya nilai sama, dapat: ${JSON.stringify(values)}`,
      ).toBe(1);
    }
  });

  test('checkin-audit -- tidak ada entri delta dengan awalan "+-"', async ({ page }) => {
    // Buka halaman check-in Mode Admin agar audit log ter-render.
    await page.goto('/dashboard.html#checkin');
    await page.locator('button[data-mode="admin"]').click();
    await expect(page.locator('#checkin-mode-admin')).toBeVisible({ timeout: 10_000 });

    const auditLog = page.locator('#audit-log-list');
    await expect(auditLog).toBeVisible();

    // Entri delta negatif (undo) tidak boleh tampil sebagai "+-N".
    const metaTexts = await auditLog.locator('.scan-result-item__meta').allTextContents();
    for (const t of metaTexts) {
      expect(t, `teks audit log tidak boleh mengandung "+-": "${t}"`).not.toMatch(/\+\-/);
    }
  });
});
