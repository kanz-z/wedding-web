import { Page, Locator } from '@playwright/test';

export class AdminPage {
  readonly page: Page;
  readonly tableBody: Locator;
  readonly tableRows: Locator;
  readonly roleBadges: Locator;
  readonly skeleton: Locator;
  readonly emptyState: Locator;
  readonly errorState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tableBody = page.locator('#admin-tbody');
    this.tableRows = page.locator('#admin-tbody tr');
    this.roleBadges = page.locator('.badge-dash');
    this.skeleton = page.locator('#admin-skeleton');
    this.emptyState = page.locator('#admin-empty');
    this.errorState = page.locator('#admin-error');
  }

  async goto() {
    await this.page.goto('/dashboard.html#admin');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }
}
