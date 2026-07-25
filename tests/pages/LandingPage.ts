import { Page, Locator } from '@playwright/test';

/**
 * Page Object untuk halaman undangan publik (index.html).
 * Mencakup semua section: Cover, Beranda, Acara, Countdown, Dress Code, RSVP, Hadiah, Guestbook.
 *
 * Selector menggunakan kombinasi getByRole, getByPlaceholder, dan locator('id').
 * Hindari class CSS spesifik karena rawan berubah.
 */
export class LandingPage {
  readonly page: Page;

  // Cover section
  readonly greetingHeading: Locator;
  readonly coupleName: Locator;
  readonly lihatUndanganLink: Locator;

  // Bottom-tab navigation
  readonly navHome: Locator;
  readonly navInfo: Locator;
  readonly navDressCode: Locator;
  readonly navRsvp: Locator;
  readonly navGifts: Locator;
  readonly navGuestbook: Locator;

  // RSVP form
  readonly rsvpSection: Locator;
  readonly rsvpNameInput: Locator;
  readonly rsvpGuestCountInput: Locator;
  readonly rsvpAttendanceSelect: Locator;
  readonly rsvpWaInput: Locator;
  readonly rsvpDoaTextarea: Locator;
  readonly rsvpSubmitButton: Locator;

  // Guestbook
  readonly guestbookSection: Locator;
  readonly guestbookNameInput: Locator;
  readonly guestbookMessageInput: Locator;
  readonly guestbookCharCount: Locator;
  readonly guestbookSubmitButton: Locator;
  readonly guestbookMessages: Locator;

  // Gift section
  readonly giftsSection: Locator;
  readonly giftCopyButtons: Locator;

  // Common
  readonly toastMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // --- Cover ---
    this.greetingHeading = page.getByRole('heading', { name: /Dear/ });
    this.coupleName = page.getByRole('heading', { name: 'Reza & Ashila' });
    this.lihatUndanganLink = page.getByRole('link', { name: 'Lihat Undangan' });

    // --- Bottom-tab nav (href anchor) ---
    this.navHome = page.locator('a[href="#home"]');
    this.navInfo = page.locator('a[href="#info"]');
    this.navDressCode = page.locator('a[href="#dresscode"]');
    this.navRsvp = page.locator('a[href="#rsvp"]');
    this.navGifts = page.locator('a[href="#gifts"]');
    this.navGuestbook = page.locator('a[href="#guestbook-section"]');

    // --- RSVP form ---
    this.rsvpSection = page.locator('#rsvp');
    this.rsvpNameInput = page.getByPlaceholder(/Cth: Muhammad Fajar/);
    this.rsvpGuestCountInput = page.locator('#rsvp').locator('[type="number"]');
    this.rsvpAttendanceSelect = page.locator('#rsvp').getByRole('combobox');
    this.rsvpWaInput = page.getByPlaceholder(/Cth: 0812xxx/);
    this.rsvpDoaTextarea = page.getByPlaceholder(/Tuliskan doa/);
    this.rsvpSubmitButton = page.locator('#rsvp').getByRole('button', { name: /Kirim/ });

    // --- Guestbook ---
    this.guestbookSection = page.locator('#guestbook-section');
    this.guestbookNameInput = page.locator('#guestbook-section').getByPlaceholder('Nama Anda');
    this.guestbookMessageInput = page.locator('#guestbook-section').getByPlaceholder(/Tulis ucapan/);
    this.guestbookCharCount = this.guestbookSection.locator('text=/\\d+\\/500/');
    this.guestbookSubmitButton = page.locator('#guestbook-section').getByRole('button', { name: 'Kirim Ucapan' });
    // Guestbook items container — fallback ke section container
    this.guestbookMessages = page.locator('#guestbook-section');

    // --- Gift section ---
    this.giftsSection = page.locator('#gifts');
    this.giftCopyButtons = page.locator('#gifts').getByRole('button');

    // --- Common ---
    this.toastMessage = page.locator('.toast, [role="alert"], [class*="toast"]');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Scroll ke section tertentu, lalu tunggu AOS fade-in animation selesai (~500ms).
   */
  async scrollToSection(sectionId: string) {
    await this.page.locator(`#${sectionId}`).scrollIntoViewIfNeeded();
    // AOS fade-up duration = 400ms + buffer
    await this.page.waitForTimeout(500);
  }

  /**
   * Isi dan submit RSVP form.
   */
  async submitRsvp(params: {
    name: string;
    guestCount: number;
    attendance: 'Hadir' | 'Tidak Hadir';
    wa: string;
    doa?: string;
  }) {
    await this.scrollToSection('rsvp');
    await this.rsvpNameInput.fill(params.name);
    await this.rsvpGuestCountInput.fill(String(params.guestCount));
    await this.rsvpAttendanceSelect.selectOption(params.attendance);
    await this.rsvpWaInput.fill(params.wa);
    if (params.doa) {
      await this.rsvpDoaTextarea.fill(params.doa);
    }
    await this.rsvpSubmitButton.click();
  }

  /**
   * Kirim ucapan di guestbook.
   */
  async submitGuestbookMessage(nama: string, pesan: string) {
    await this.scrollToSection('guestbook-section');
    await this.guestbookNameInput.fill(nama);
    await this.guestbookMessageInput.fill(pesan);
    await this.guestbookSubmitButton.click();
  }

  /** Navigasi via bottom-tab */
  async navigateTo(section: 'home' | 'info' | 'dresscode' | 'rsvp' | 'gifts' | 'guestbook') {
    const map: Record<string, Locator> = {
      home: this.navHome,
      info: this.navInfo,
      dresscode: this.navDressCode,
      rsvp: this.navRsvp,
      gifts: this.navGifts,
      guestbook: this.navGuestbook,
    };
    await map[section].click();
    await this.page.waitForTimeout(500);
  }
}
