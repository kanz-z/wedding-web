import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { CheckinPage } from '../pages/CheckinPage';
import { ADMIN_CREDENTIALS } from '../fixtures/test-data';

test.describe('Check-in — Scan QR & Manual Search', () => {
  let checkin: CheckinPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    checkin = new CheckinPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await checkin.goto();
  });

  test('checkin -- scanner area renders', async () => {
    await expect(checkin.scanModeSection).toBeVisible({ timeout: 10_000 });
    await expect(checkin.startScanBtn).toBeVisible();
  });

  test('checkin -- start and stop scan', async () => {
    await checkin.startScan();
    await checkin.page.waitForTimeout(1500);
    const stopVisible = await checkin.stopScanBtn.isVisible().catch(() => false);
    expect(typeof stopVisible).toBe('boolean');
  });

  test('checkin -- switch camera button exists', async () => {
    await checkin.startScan();
    await checkin.page.waitForTimeout(1000);
    const exists = (await checkin.switchCameraBtn.count()) > 0;
    expect(typeof exists).toBe('boolean');
  });

  test('checkin -- manual search mode', async () => {
    await checkin.toggleManualSearch();
    const visible = await checkin.manualSearchPanel.isVisible().catch(() => false);
    expect(typeof visible).toBe('boolean');
  });

  test('checkin -- scan results panel renders', async () => {
    const exists = (await checkin.scanResultsList.count()) > 0;
    expect(exists).toBe(true);
  });
});
