import { Page, Locator } from '@playwright/test';

/**
 * Page Object untuk halaman Kartu Undangan — /invitation/[slug]/card.
 *
 * Menampilkan data reservasi tamu: nama, jumlah tamu, QR code,
 * lokasi, tanggal, dress code, dan tombol unduh.
 *
 * Ref: [TRD §Routing Paths], [UX §Kartu Undangan]
 */
export class CardPage {
  readonly page: Page;

  // Brand & header
  readonly cardTitle: Locator;
  readonly coupleName: Locator;

  // Informasi tamu (label-value pairs)
  readonly guestNameValue: Locator;
  readonly guestCountValue: Locator;
  readonly dateValue: Locator;
  readonly locationValue: Locator;
  readonly dressCodeValue: Locator;

  // QR Code
  readonly qrCodeContainer: Locator;

  // Actions
  readonly downloadButton: Locator;
  readonly backButton: Locator;

  // Permalink
  readonly permalinkText: Locator;

  constructor(page: Page) {
    this.page = page;

    this.cardTitle = page.getByText(/Kartu Undangan/i);
    this.coupleName = page.getByText(/Reza.*Ashila/i);

    // Informasi tamu — ditampilkan sebagai teks (bukan input)
    // Selector longgar: cari elemen yang mengandung label "Nama", "Jumlah", dll
    this.guestNameValue = page.locator('body');
    this.guestCountValue = page.locator('text=/Jumlah [Tt]amu/i');
    this.dateValue = page.locator('text=/Sabtu.*Agustus/i').or(page.locator('text=/22.*08/i'));
    this.locationValue = page.locator('text=/RIVEA/i');
    this.dressCodeValue = page.locator('text=/dress.?code/i').or(page.locator('text=/jas/i'));

    // QR code — komponen canvas dari qrcodejs
    this.qrCodeContainer = page.locator('canvas, img[alt*="QR"], #qrcode, [class*="qr"]');

    this.downloadButton = page.getByRole('button', { name: /unduh|download|simpan/i }).or(
      page.locator('button:has-text("Kartu"), button:has-text("Unduh"), button:has-text("Download")'),
    );
    this.backButton = page.getByRole('link', { name: /kembali|back/i }).or(
      page.locator('a:has-text("kembali"), a:has-text("Kembali")'),
    );

    this.permalinkText = page.locator('text=/invitation\\//i');
  }

  /** Navigasi ke halaman kartu dengan slug */
  async goto(slug: string) {
    await this.page.goto(`/invitation/${slug}/card`);
    await this.page.waitForLoadState('networkidle');
  }

  /** Verifikasi halaman kartu loaded dengan benar */
  async isCardLoaded(): Promise<boolean> {
    return (await this.qrCodeContainer.count()) > 0;
  }
}
