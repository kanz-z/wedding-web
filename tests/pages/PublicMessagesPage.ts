import { Page, Locator } from '@playwright/test';

export class PublicMessagesPage {
  readonly page: Page;
  readonly messagesList: Locator;
  readonly skeleton: Locator;
  readonly emptyState: Locator;
  readonly errorState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messagesList = page.locator('#public-messages-list');
    this.skeleton = page.locator('#public-skeleton');
    this.emptyState = page.locator('#public-empty');
    this.errorState = page.locator('#public-error');
  }

  async goto() {
    await this.page.goto('/dashboard.html#public');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }
}
