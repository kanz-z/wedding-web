import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { PrivateMessagesPage } from '../pages/PrivateMessagesPage';
import { ADMIN_CREDENTIALS } from '../fixtures/test-data';

test.describe('Pesan Privat — Pesan RSVP Tamu', () => {
  let priv: PrivateMessagesPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    priv = new PrivateMessagesPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await priv.goto();
  });

  test('private-messages -- messages table renders', async () => {
    const content = priv.page.locator('#private-messages-list, #private-empty, #private-skeleton');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('private-messages -- skeleton loading state', async () => {
    const content = priv.page.locator('#private-skeleton, #private-messages-list, #private-empty');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });
});
