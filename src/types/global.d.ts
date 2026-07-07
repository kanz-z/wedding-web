/* ===========================================
   Global declarations untuk proyek ini
   =========================================== */

// Module declarations untuk library tanpa tipe
declare module 'aos';
declare module 'qrcodejs';
declare module 'html2canvas';

// simplyCountdown dari CDN (public/countdown/simplyCountdown.umd.js)
declare function simplyCountdown(
  el: HTMLElement | null,
  opts: {
    year?: number;
    month?: number;
    day?: number;
    words?: { days: string };
    sectionClass?: string;
    amountClass?: string;
    wordClass?: string;
  }
): void;

// Window global — fungsi yang di-assign untuk inline onclick di HTML
interface Window {
  enableScroll: () => void;
  showBottomNav: () => void;
  copyToClipboard: (text: string) => void;
  fetchGuestbook: (page?: number) => Promise<void>;
  showScreen: (name: string) => void;
  switchTab: (tabId: string) => void;
  loadOverview: () => Promise<void>;
  loadTamuRSVP: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setTamuFilter: (filter: string, btn: any) => void;
  copyGuestLink: (slug: string, token: string, pronoun: string) => void;
  editTamu: (guestId: string) => void;
  editOrphan: (rsvpId: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  confirmGuest: (guestId: string, btn: any) => Promise<void>;
  showGuestModal: (guestData: unknown, rsvpData: unknown) => void;
  closeGuestModal: () => void;
  showImportModal: () => void;
  closeImportModal: () => void;
  executeImport: () => Promise<void>;
  downloadBatchKartu: () => Promise<void>;
  confirmBatchDelete: () => Promise<void>;
  cancelBatchDownload: () => void;
  toggleSelectAll: (checked: boolean) => void;
  toggleSelect: (guestId: string, checked: boolean) => void;
  switchImportTab: (tab: string) => void;
  loadGuestbook: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setGbFilter: (filter: string, btn: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toggleGbApproval: (id: string, newVal: boolean, btn: any) => Promise<void>;
  startScanner: () => void;
  stopScanner: () => void;
  loadCheckinLog: () => Promise<void>;
  loadPesanPrivat: () => Promise<void>;
  loadAdminList: () => Promise<void>;
  showToast: (message: string, isError?: boolean) => void;
  playAudio: () => void;
  init: () => Promise<void>;
  verifyAdmin: (user: { email: string }) => void;
  setActiveNav: (sectionId: string) => void;
}
