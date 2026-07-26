import { Page, Locator } from '@playwright/test';

/**
 * Page Object untuk Hub Dashboard (dashboard.html#hub).
 * Mencakup summary cards, widget cards navigasi, dan panel notifikasi.
 */
export class HubPage {
  readonly page: Page;

  // Summary stat cards
  readonly summaryCards: Locator;

  // Widget navigasi
  readonly widgetCards: Locator;

  // Notifikasi
  readonly notificationBell: Locator;
  readonly notificationPanel: Locator;
  readonly notificationPanelClose: Locator;
  readonly notificationOverlay: Locator;

  // Event status toggle
  readonly eventStatusSwitch: Locator;
  readonly eventStatusLabel: Locator;

  constructor(page: Page) {
    this.page = page;

    this.summaryCards = page.locator('.summary-card');
    this.widgetCards = page.locator('.widget-card');

    this.notificationBell = page.locator('#btn-notif');
    this.notificationPanel = page.locator('#notif-panel');
    this.notificationPanelClose = page.locator('#notif-panel-close');
    this.notificationOverlay = page.locator('#notif-overlay');

    this.eventStatusSwitch = page.locator('#event-status-switch');
    this.eventStatusLabel = page.locator('#event-status-label');
  }

  async goto() {
    await this.page.goto('/dashboard.html#hub');
    await this.page.waitForLoadState('networkidle');
  }

  /** Buka panel notifikasi */
  async openNotifications() {
    await this.notificationBell.click();
    await this.page.waitForTimeout(300);
  }

  /** Tutup panel notifikasi via tombol close */
  async closeNotifications() {
    await this.notificationPanelClose.click();
    await this.page.waitForTimeout(300);
  }
}
