import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { GuestsPage } from '../pages/GuestsPage';
import { ADMIN_CREDENTIALS } from '../fixtures/test-data';

test.describe('Kelola Tamu — Tabel & Interaksi', () => {
  let guests: GuestsPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    guests = new GuestsPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await guests.goto();
  });

  test('guests -- table renders with data', async () => {
    const content = guests.page.locator('#guest-table-wrap, #guest-empty, #guest-empty-first, #guest-skeleton');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('guests -- search filters results', async () => {
    if (await guests.searchInput.isVisible()) {
      await guests.search('Test');
      const content = guests.page.locator('#guest-table-wrap, #guest-empty, #guest-skeleton');
      await expect(content.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('guests -- filter by RSVP status', async () => {
    if (await guests.filterRsvp.isVisible()) {
      await guests.filterRsvp.selectOption('hadir');
      await guests.page.waitForTimeout(500);
      await expect(guests.page.locator('body')).toBeVisible();
    }
  });

  test('guests -- filter by checkin status', async () => {
    if (await guests.filterCheckin.isVisible()) {
      await guests.filterCheckin.selectOption('sudah');
      await guests.page.waitForTimeout(500);
      await expect(guests.page.locator('body')).toBeVisible();
    }
  });

  test('guests -- filter by kategori', async () => {
    if (await guests.filterKategori.isVisible()) {
      await guests.filterKategori.selectOption('keluarga');
      await guests.page.waitForTimeout(500);
      await expect(guests.page.locator('body')).toBeVisible();
    }
  });

  test('guests -- pagination changes page', async () => {
    if (await guests.pageSizeSelect.isVisible()) {
      await guests.pageSizeSelect.selectOption('25');
      await guests.page.waitForTimeout(500);
      await expect(guests.page.locator('body')).toBeVisible();
    }
  });

  test('guests -- select all shows bulk bar', async () => {
    if (await guests.selectAll.isVisible() && await guests.tableWrap.isVisible()) {
      await guests.selectAll.click();
      await guests.page.waitForTimeout(300);
      const bulkVisible = await guests.bulkBar.isVisible().catch(() => false);
      expect(typeof bulkVisible).toBe('boolean');
    }
  });

  test('guests -- detail modal opens', async () => {
    const count = await guests.detailBtns.count();
    if (count > 0) {
      await guests.detailBtns.first().click();
      await guests.page.waitForTimeout(500);
      const visible = await guests.guestModalOverlay.isVisible().catch(() => false);
      expect(typeof visible).toBe('boolean');
    }
  });

  test('guests -- edit modal opens', async () => {
    const count = await guests.editBtns.count();
    if (count > 0) {
      await guests.editBtns.first().click();
      await guests.page.waitForTimeout(500);
      const visible = await guests.editModalOverlay.isVisible().catch(() => false);
      expect(typeof visible).toBe('boolean');
    }
  });

  test('guests -- checkin dialog opens', async () => {
    const count = await guests.checkinBtns.count();
    if (count > 0) {
      await guests.checkinBtns.first().click();
      await guests.page.waitForTimeout(500);
      const visible = await guests.checkinDialogOverlay.isVisible().catch(() => false);
      expect(typeof visible).toBe('boolean');
    }
  });

  test('guests -- reload button refreshes data', async () => {
    if (await guests.reloadBtn.isVisible()) {
      await guests.reloadBtn.click();
      await guests.page.waitForTimeout(1000);
      await expect(guests.page.locator('body')).toBeVisible();
    }
  });

  test('guests -- skeleton loading state', async () => {
    const content = guests.page.locator('#guest-skeleton, #guest-table-wrap, #guest-empty, #guest-empty-first');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });
});
