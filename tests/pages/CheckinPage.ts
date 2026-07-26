import { Page, Locator } from '@playwright/test';

export class CheckinPage {
  readonly page: Page;
  readonly scanModeSection: Locator;
  readonly startScanBtn: Locator;
  readonly stopScanBtn: Locator;
  readonly switchCameraBtn: Locator;
  readonly toggleManualBtn: Locator;
  readonly manualSearchPanel: Locator;
  readonly manualSearchInput: Locator;
  readonly scanResultsList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scanModeSection = page.locator('#checkin-mode-scan');
    this.startScanBtn = page.locator('#btn-start-scan');
    this.stopScanBtn = page.locator('#btn-stop-scan');
    this.switchCameraBtn = page.locator('#btn-switch-camera');
    this.toggleManualBtn = page.locator('#btn-toggle-manual');
    this.manualSearchPanel = page.locator('#manual-search-panel');
    this.manualSearchInput = page.locator('#manual-checkin-search');
    this.scanResultsList = page.locator('#scan-results-list');
  }

  async goto() {
    await this.page.goto('/dashboard.html#checkin');
    await this.page.waitForLoadState('networkidle');
  }

  async startScan() {
    await this.startScanBtn.click();
    await this.page.waitForTimeout(500);
  }

  async toggleManualSearch() {
    await this.toggleManualBtn.click();
    await this.page.waitForTimeout(300);
  }
}
