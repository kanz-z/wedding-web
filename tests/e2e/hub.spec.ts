import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { HubPage } from '../pages/HubPage';
import { ADMIN_CREDENTIALS } from '../fixtures/test-data';

test.describe('Hub Dashboard — Ringkasan & Navigasi', () => {
  let hub: HubPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    hub = new HubPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
  });

  test('hub -- summary stat cards render', async () => {
    await expect(hub.summaryCards.first()).toBeVisible({ timeout: 10_000 });
    const count = await hub.summaryCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('hub -- navigation widget cards clickable', async () => {
    const count = await hub.widgetCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      const dataGoto = await hub.widgetCards.nth(i).getAttribute('data-goto');
      expect(dataGoto).toBeTruthy();
    }
  });

  test('hub -- notification panel opens and closes', async () => {
    await hub.openNotifications();
    await expect(hub.notificationPanel).toBeVisible({ timeout: 5000 });
    await hub.closeNotifications();
    await expect(hub.notificationPanel).not.toBeVisible({ timeout: 3000 });
  });
});
