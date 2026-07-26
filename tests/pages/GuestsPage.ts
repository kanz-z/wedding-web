import { Page, Locator } from '@playwright/test';

/**
 * Page Object untuk halaman Kelola Tamu (dashboard.html#guests).
 * Mencakup tabel tamu, search, filter, pagination, bulk bar,
 * modal detail/edit, dan skeleton loading.
 */
export class GuestsPage {
  readonly page: Page;

  // Table
  readonly tableBody: Locator;
  readonly tableRows: Locator;
  readonly tableWrap: Locator;

  // Search & filter
  readonly searchInput: Locator;
  readonly searchClearBtn: Locator;
  readonly filterCheckin: Locator;
  readonly filterRsvp: Locator;
  readonly filterKategori: Locator;

  // Bulk bar
  readonly selectAll: Locator;
  readonly bulkBar: Locator;
  readonly bulkCount: Locator;

  // Pagination
  readonly pageSizeSelect: Locator;
  readonly paginationInfo: Locator;
  readonly pagination: Locator;

  // Actions
  readonly reloadBtn: Locator;
  readonly detailBtns: Locator;
  readonly editBtns: Locator;
  readonly checkinBtns: Locator;

  // Modals
  readonly guestModalOverlay: Locator;
  readonly editModalOverlay: Locator;
  readonly checkinDialogOverlay: Locator;

  // Skeleton & states
  readonly skeleton: Locator;
  readonly emptyState: Locator;
  readonly emptyFirst: Locator;
  readonly errorState: Locator;

  constructor(page: Page) {
    this.page = page;

    this.tableBody = page.locator('#guest-tbody');
    this.tableRows = page.locator('#guest-tbody tr[data-id]');
    this.tableWrap = page.locator('#guest-table-wrap');

    this.searchInput = page.locator('#guest-search');
    this.searchClearBtn = page.locator('#search-clear');
    this.filterCheckin = page.locator('#filter-checkin');
    this.filterRsvp = page.locator('#filter-rsvp');
    this.filterKategori = page.locator('#filter-kategori');

    this.selectAll = page.locator('#select-all-guests');
    this.bulkBar = page.locator('#bulk-bar');
    this.bulkCount = page.locator('#bulk-count');

    this.pageSizeSelect = page.locator('#page-size-select');
    this.paginationInfo = page.locator('#guest-pagination-info');
    this.pagination = page.locator('#guest-pagination');

    this.reloadBtn = page.locator('#btn-reload-guests');
    this.detailBtns = page.locator('[data-action="detail"]');
    this.editBtns = page.locator('[data-action="edit"]');
    this.checkinBtns = page.locator('[data-action="checkin"]');

    this.guestModalOverlay = page.locator('#guest-modal-overlay');
    this.editModalOverlay = page.locator('#edit-modal-overlay');
    this.checkinDialogOverlay = page.locator('#checkin-dialog-overlay');

    this.skeleton = page.locator('#guest-skeleton');
    this.emptyState = page.locator('#guest-empty');
    this.emptyFirst = page.locator('#guest-empty-first');
    this.errorState = page.locator('#guest-error');
  }

  async goto() {
    await this.page.goto('/dashboard.html#guests');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(400);
  }
}
