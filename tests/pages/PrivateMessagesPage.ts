import { Page, Locator } from '@playwright/test';

export class PrivateMessagesPage {
  readonly page: Page;
  readonly messagesList: Locator;
  readonly skeleton: Locator;
  readonly emptyState: Locator;
  readonly errorState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messagesList = page.locator('#private-messages-list');
    this.skeleton = page.locator('#private-skeleton');
    this.emptyState = page.locator('#private-empty');
    this.errorState = page.locator('#private-error');
  }

  async goto() {
    await this.page.goto('/dashboard.html#private');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }
}
