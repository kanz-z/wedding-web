import { test, expect } from '@playwright/test';

test.describe('Role-Based Access Control', () => {
  test('superadmin — semua tab navigasi muncul', async ({ page }) => {
    // Auth dari storageState — langsung navigasi ke hub
    await page.goto('/dashboard.html#hub');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-goto="guests"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-goto="checkin"]').first()).toBeVisible();
    await expect(page.locator('[data-goto="admin"]').first()).toBeVisible();
  });

  test('superadmin — tab Admin menampilkan table dengan role badge', async ({ page }) => {
    await page.goto('/dashboard.html#admin');
    await page.waitForLoadState('networkidle');

    // Tunggu skeleton hilang atau tbody/empty muncul
    await page.waitForFunction(() => {
      const skel = document.getElementById('admin-skeleton');
      if (skel && !skel.classList.contains('d-none-important')) return false;
      return !!(document.getElementById('admin-tbody') || document.getElementById('admin-empty'));
    }, { timeout: 10_000 });

    const badges = page.locator('.badge-dash');
    const badgeCount = await badges.count();
    if (badgeCount > 0) {
      await expect(badges.first()).toBeVisible();
    }
  });

  test('superadmin — tombol Tambah Tamu dan Bulk Delete muncul', async ({ page }) => {
    await page.goto('/dashboard.html#guests');
    await page.waitForLoadState('networkidle');

    // Tunggu skeleton hilang atau guest-tbody muncul
    await page.waitForFunction(() => {
      const skel = document.getElementById('guest-skeleton');
      if (skel && !skel.classList.contains('d-none-important')) return false;
      return !!(document.getElementById('guest-tbody') || document.getElementById('guest-empty'));
    }, { timeout: 10_000 });

    expect(await page.locator('#btn-add-guest').count()).toBeGreaterThan(0);
    expect(await page.locator('#bulk-del').count()).toBeGreaterThan(0);
  });

  test('applyRoleRestrictions — DOM elements for role-based hiding exist', async ({ page }) => {
    await page.goto('/dashboard.html#hub');
    await page.waitForLoadState('networkidle');

    expect(await page.locator('[data-goto="checkin"]').count()).toBeGreaterThan(0);
    expect(await page.locator('[data-goto="admin"]').count()).toBeGreaterThan(0);
    expect(await page.locator('#btn-add-guest').count()).toBeGreaterThan(0);
    expect(await page.locator('#bulk-del').count()).toBeGreaterThan(0);
  });

  test('guestbook page accessible', async ({ page }) => {
    await page.goto('/dashboard.html#public');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#page-404')).not.toBeVisible({ timeout: 5_000 });
  });

  test('private messages page accessible', async ({ page }) => {
    await page.goto('/dashboard.html#private');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#page-404')).not.toBeVisible({ timeout: 5_000 });
  });
});
