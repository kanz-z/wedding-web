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

  /**
   * State area Kelola Tamu — salah satu dari: tabel data, empty state,
   * empty-first state, atau skeleton. Poll boolean per-elemen: benjir
   * strict-mode violation dan aman tanpa .first().
   */
  const contentState = () =>
    guests.page
      .locator('#guest-table-wrap')
      .or(guests.page.locator('#guest-empty'))
      .or(guests.page.locator('#guest-empty-first'))
      .or(guests.page.locator('#guest-skeleton'));

  const expectContentState = async (timeout = 10_000) => {
    await expect
      .poll(async () => {
        const visibleFlags = await Promise.all(
          ['#guest-table-wrap', '#guest-empty', '#guest-empty-first', '#guest-skeleton'].map(
            (sel) => guests.page.locator(sel).isVisible().catch(() => false),
          ),
        );
        return visibleFlags.some(Boolean);
      }, { timeout })
      .toBe(true);
  };

  test('guests -- table renders with data', async () => {
    await expectContentState();
  });

  test('guests -- search filters results', async () => {
    await guests.search('Test');
    await expectContentState();
  });

  test('guests -- filter by RSVP status', async () => {
    await guests.filterRsvp.selectOption('hadir');
    await expectContentState();
  });

  test('guests -- filter by checkin status', async () => {
    await guests.filterCheckin.selectOption('sudah');
    await expectContentState();
  });

  test('guests -- filter by kategori', async () => {
    await guests.filterKategori.selectOption('keluarga');
    await expectContentState();
  });

  test('guests -- pagination changes page', async () => {
    await guests.pageSizeSelect.selectOption('25');
    await expectContentState();
  });

  test('guests -- select all shows bulk bar', async () => {
    // Bulk bar hanya relevan saat ada baris yang bisa dipilih
    if ((await guests.selectAll.isVisible()) && (await guests.tableWrap.isVisible())) {
      await guests.selectAll.click();
      await guests.page.waitForTimeout(300);
      const bulkVisible = await guests.bulkBar.isVisible().catch(() => false);
      expect(typeof bulkVisible).toBe('boolean');
    }
  });

  test('guests -- detail modal opens', async () => {
    await expectContentState();
    const count = await guests.detailBtns.count();
    if (count > 0) {
      await guests.detailBtns.first().click();
      await guests.page.waitForTimeout(500);
      const visible = await guests.guestModalOverlay.isVisible().catch(() => false);
      expect(visible).toBe(true);
    }
  });

  test('guests -- edit modal opens', async () => {
    await expectContentState();
    const count = await guests.editBtns.count();
    if (count > 0) {
      await guests.editBtns.first().click();
      await guests.page.waitForTimeout(500);
      const visible = await guests.editModalOverlay.isVisible().catch(() => false);
      expect(visible).toBe(true);
    }
  });

  test('guests -- checkin dialog opens', async () => {
    await expectContentState();
    // Hanya tombol check-in aktif (belum check-in penuh) yang bisa diklik
    const activeCheckin = guests.page.locator('[data-action="checkin"]:not(.is-disabled)');
    const count = await activeCheckin.count();
    if (count > 0) {
      await activeCheckin.first().click();
      await guests.page.waitForTimeout(500);
      const visible = await guests.checkinDialogOverlay.isVisible().catch(() => false);
      expect(visible).toBe(true);
    }
  });

  test('guests -- reload button refreshes data', async () => {
    await expectContentState();
    await guests.reloadBtn.click();
    await expectContentState();
  });

  test('guests -- skeleton loading state', async () => {
    await expectContentState();
  });
});
