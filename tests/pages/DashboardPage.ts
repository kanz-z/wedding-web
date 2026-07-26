import { Page, Locator } from '@playwright/test';

/**
 * Page Object untuk Dashboard Admin (dashboard.html#hub dan turunannya).
 * Dashboard menggunakan hash-based routing.
 */
export class DashboardPage {
  readonly page: Page;

  readonly brandText: Locator;
  readonly notificationBell: Locator;
  readonly logoutButton: Locator;

  // Hub navigation
  readonly hubTitle: Locator;
  readonly navCardGuests: Locator;
  readonly navCardCheckin: Locator;
  readonly navCardReservations: Locator;
  readonly navCardPrivateMessages: Locator;
  readonly navCardPublicMessages: Locator;
  readonly navCardAdmin: Locator;

  // Tamu page
  readonly guestTable: Locator;
  readonly guestSearchInput: Locator;
  readonly guestRows: Locator;

  // States
  readonly loadingSkeleton: Locator;
  readonly emptyState: Locator;
  readonly toastNotification: Locator;

  constructor(page: Page) {
    this.page = page;

    this.brandText = page.getByText('Reza & Ashila').first();
    this.notificationBell = page.locator('[class*="notification"], .bell, .bi-bell');
    this.logoutButton = page.getByRole('button', { name: /keluar|logout/i }).or(
      page.locator('[class*="logout"]'),
    );

    this.hubTitle = page.getByRole('heading', { name: /dashboard|hub/i });
    this.navCardGuests = page.locator('a[href="#guests"]');
    this.navCardCheckin = page.locator('a[href="#checkin"]');
    this.navCardReservations = page.locator('a[href="#reservations"]');
    this.navCardPrivateMessages = page.locator('a[href="#private"]');
    this.navCardPublicMessages = page.locator('a[href="#public"]');
    this.navCardAdmin = page.locator('a[href="#admin"]');

    this.guestTable = page.locator('table, [role="table"]');
    this.guestSearchInput = page.getByPlaceholder(/cari|search/i);
    this.guestRows = page.locator('tbody tr, [role="row"]');

    this.loadingSkeleton = page.locator('[class*="skeleton"], [class*="placeholder-glow"]');
    this.emptyState = page.locator('[class*="empty"]');
    this.toastNotification = page.locator('.toast, [role="alert"], [class*="toast"]');
  }

  async goto() {
    await this.page.goto('/dashboard.html#hub');
    await this.page.waitForLoadState('networkidle');
  }

  async navigateTo(page: 'guests' | 'checkin' | 'reservations' | 'private' | 'public' | 'admin') {
    const map: Record<string, Locator> = {
      guests: this.navCardGuests,
      checkin: this.navCardCheckin,
      reservations: this.navCardReservations,
      private: this.navCardPrivateMessages,
      public: this.navCardPublicMessages,
      admin: this.navCardAdmin,
    };
    await map[page].click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Dapatkan halaman aktif berdasarkan data-page attribute */
  getActivePage(): Locator {
    return this.page.locator('.app-page:not(.d-none-important)');
  }

  async searchGuest(query: string) {
    await this.guestSearchInput.fill(query);
    await this.page.waitForTimeout(400);
  }

  async logout() {
    await this.logoutButton.click();
    await this.page.waitForURL('**/dashboard.html', { timeout: 10_000 });
  }
}
