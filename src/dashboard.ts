// src/dashboard.ts — entry point for dashboard.html
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/dashboard.css';
import './styles/card.css';

import { config } from './config';

// Import modules (side-effects)
import './dashboard/state';
import './dashboard/utils';
import './dashboard/auth';
import './dashboard/navigation';
import './dashboard/overview';
import './dashboard/tamu';
import './dashboard/operations';
import './dashboard/guestbook';
import './dashboard/qr';
import './dashboard/pesan-admin';
import './dashboard/dashboard';

// Inline onclick handlers
import { showScreen } from './dashboard/utils';
import { init, verifyAdmin } from './dashboard/auth';
import { switchTab } from './dashboard/navigation';
import { loadOverview } from './dashboard/overview';
import {
  loadTamuRSVP,
  setTamuFilter,
  copyGuestLink,
  editTamu,
  editOrphan,
  confirmGuest,
  showGuestModal,
  closeGuestModal,
} from './dashboard/tamu';
import {
  showImportModal,
  closeImportModal,
  executeImport,
  downloadBatchKartu,
  confirmBatchDelete,
  cancelBatchDownload,
  toggleSelectAll,
  toggleSelect,
  switchImportTab,
} from './dashboard/operations';
import {
  loadGuestbook,
  setGbFilter,
  toggleGbApproval,
} from './dashboard/guestbook';
import { startScanner, stopScanner, loadCheckinLog } from './dashboard/qr';
import { loadPesanPrivat, loadAdminList } from './dashboard/pesan-admin';

window.loadOverview = loadOverview;
window.loadTamuRSVP = loadTamuRSVP;
window.setTamuFilter = setTamuFilter;
window.copyGuestLink = copyGuestLink;
window.editTamu = editTamu;
window.editOrphan = editOrphan;
window.confirmGuest = confirmGuest;
window.showGuestModal = showGuestModal as (guestData: unknown, rsvpData: unknown) => void;
window.closeGuestModal = closeGuestModal;
window.toggleSelectAll = toggleSelectAll;
window.toggleSelect = toggleSelect;
window.showImportModal = showImportModal;
window.closeImportModal = closeImportModal;
window.switchImportTab = switchImportTab;
window.executeImport = executeImport;
window.downloadBatchKartu = downloadBatchKartu;
window.confirmBatchDelete = confirmBatchDelete;
window.cancelBatchDownload = cancelBatchDownload;
window.loadGuestbook = loadGuestbook;
window.setGbFilter = setGbFilter;
window.toggleGbApproval = toggleGbApproval;
window.startScanner = startScanner;
window.stopScanner = stopScanner;
window.loadCheckinLog = loadCheckinLog;
window.loadPesanPrivat = loadPesanPrivat;
window.loadAdminList = loadAdminList;
window.init = init;
window.switchTab = switchTab;
