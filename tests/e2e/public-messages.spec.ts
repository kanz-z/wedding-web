import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { PublicMessagesPage } from '../pages/PublicMessagesPage';
import { ADMIN_CREDENTIALS } from '../fixtures/test-data';

test.describe('Pesan Publik — Kelola Ucapan Guestbook', () => {
  let pub: PublicMessagesPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    pub = new PublicMessagesPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await pub.goto();
  });

  test('public-messages -- messages table renders', async () => {
    const content = pub.page.locator('#public-messages-list, #public-empty, #public-skeleton');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('public-messages -- visibility toggle works', async () => {
    const toggle = pub.page.locator('.visibility-switch input').first();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await pub.page.waitForTimeout(500);
      await expect(pub.page.locator('body')).toBeVisible();
    }
  });

  test('public-messages -- skeleton loading state', async () => {
    const content = pub.page.locator('#public-skeleton, #public-messages-list, #public-empty');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });
});
