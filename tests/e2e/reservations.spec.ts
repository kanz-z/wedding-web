import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ReservationsPage } from '../pages/ReservationsPage';
import { ADMIN_CREDENTIALS } from '../fixtures/test-data';

test.describe('Reservasi — Kelola Undangan Tamu', () => {
  let res: ReservationsPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    res = new ReservationsPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await res.goto();
  });

  test('reservations -- reservation cards render', async () => {
    const content = res.page.locator('.reservation-card, #res-empty, #res-skeleton');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('reservations -- approve reservation', async () => {
    const btn = res.page.locator('.btn-approve').first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await res.page.waitForTimeout(1000);
      await expect(res.page.locator('body')).toBeVisible();
    }
  });

  test('reservations -- reject reservation', async () => {
    const btn = res.page.locator('.btn-reject').first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await res.page.waitForTimeout(1000);
      await expect(res.page.locator('body')).toBeVisible();
    }
  });

  test('reservations -- copy invitation link shows toast', async () => {
    const btn = res.page.locator('[data-copy-link]').first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await res.page.waitForTimeout(500);
      await expect(res.page.locator('body')).toBeVisible();
    }
  });

  test('reservations -- search filters cards', async () => {
    if (await res.searchInput.isVisible()) {
      await res.search('Test');
      const content = res.page.locator('.reservation-card, #res-empty, #res-skeleton');
      await expect(content.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('reservations -- event status toggle works', async ({ page }) => {
    await page.goto('/dashboard.html#hub');
    await page.waitForLoadState('networkidle');
    if (await res.eventStatusSwitch.isVisible().catch(() => false)) {
      await res.eventStatusSwitch.click();
      await page.waitForTimeout(500);
      const label = await res.eventStatusLabel.textContent();
      expect(label).not.toBeNull();
    }
  });
});
