import { Page, Locator } from '@playwright/test';

export class ReservationsPage {
  readonly page: Page;
  readonly reservationCards: Locator;
  readonly searchInput: Locator;
  readonly skeleton: Locator;
  readonly emptyState: Locator;
  readonly errorState: Locator;
  readonly eventStatusSwitch: Locator;
  readonly eventStatusLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.reservationCards = page.locator('.reservation-card');
    this.searchInput = page.locator('#res-search');
    this.skeleton = page.locator('#res-skeleton');
    this.emptyState = page.locator('#res-empty');
    this.errorState = page.locator('#res-error');
    this.eventStatusSwitch = page.locator('#event-status-switch');
    this.eventStatusLabel = page.locator('#event-status-label');
  }

  async goto() {
    await this.page.goto('/dashboard.html#reservations');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(400);
  }
}
