import { Page, Locator } from '@playwright/test';

/**
 * Page Object untuk halaman login dashboard (dashboard.html).
 * Selector berbasis placeholder dan role — stabil terhadap perubahan CSS.
 */
export class LoginPage {
  readonly page: Page;

  readonly brandName: Locator;
  readonly pageSubtitle: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    this.brandName = page.getByText('Reza & Ashila').first();
    this.pageSubtitle = page.getByText('Masuk ke Dashboard Admin');
    this.emailInput = page.getByPlaceholder('admin@rezaashila.id');
    this.passwordInput = page.getByPlaceholder('••••••••');
    this.loginButton = page.getByRole('button', { name: 'Masuk' });
    this.forgotPasswordLink = page.getByRole('link', { name: 'Lupa kata sandi?' });
    this.errorMessage = page.locator('.text-danger, [class*="error"], .alert-danger');
  }

  async goto() {
    await this.page.goto('/dashboard.html');
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /** Login + tunggu redirect ke dashboard (hash #hub) */
  async loginAndWaitForDashboard(email: string, password: string) {
    await this.login(email, password);
    await this.page.waitForURL('**/dashboard.html#hub', { timeout: 15_000 });
  }
}
