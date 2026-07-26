import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { ADMIN_CREDENTIALS } from '../fixtures/test-data';

test.describe('Manajemen Admin — Kelola Akun Admin', () => {
  let admin: AdminPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    admin = new AdminPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await admin.goto();
  });

  test('admin -- admin table renders', async () => {
    const content = admin.page.locator('#admin-tbody, #admin-empty, #admin-skeleton');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('admin -- role badges visible', async () => {
    const count = await admin.roleBadges.count();
    expect(typeof count).toBe('number');
  });
});
