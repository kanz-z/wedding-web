// entry point for dashboard.html

// CSS imports (bundled by Vite)
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/dashboard.css";
import "@/styles/card.css";

// Dashboard modules
import { initNotifications, initModals, initKeyboard, renderNotifications } from "./dashboard/ui";
import { initGuestEvents, initGuestTable, reloadGuests, renderSummaryCards } from "./dashboard/guests";
import { initAuth, initRouting } from "./dashboard/auth";
import { initCheckinEvents, renderCheckinLog } from "./dashboard/checkin";
import { initReservations } from "./dashboard/reservations";
import { initMessages } from "./dashboard/messages";
import { initAdmin } from "./dashboard/admin";
import { initImportModal } from "./dashboard/import-modal";
import { fetchGuests } from "./dashboard/state";

// Initialize all modules
async function initDashboard(): Promise<void> {
  // Inisialisasi modul UI SELALU — tanpa session pun listener click/DOM harus siap.
  // initAuth() dipanggil setelahnya agar SIGNED_IN handler bisa memicu fetch data.
  initRouting();
  initNotifications();
  initModals();
  initKeyboard();
  initGuestEvents();
  initCheckinEvents();
  initReservations();
  initMessages();
  initAdmin();
  initImportModal();

  // page-changed listener: handle fetch data + render tabel
  let guestTableInited = false;
  let hubDataInited = false;
  window.addEventListener("page-changed", ((e: CustomEvent) => {
    if (e.detail.page === "hub" && !hubDataInited) {
      hubDataInited = true;
      fetchGuests().then(() => {
        renderSummaryCards();
        renderNotifications();
      }).catch((err) => {
        console.warn("[dashboard] fetchGuests awal gagal", err);
      });
    }
    if (e.detail.page === "guests") {
      if (!guestTableInited) {
        guestTableInited = true;
        initGuestTable();
      } else {
        reloadGuests();
      }
    }
    if (e.detail.page === "checkin") renderCheckinLog();
  }) as EventListener);

  // Panggil initAuth() — jika session sudah ada, checkSession() → handleHashChange()
  // akan dispatch page-changed "hub" dan listener di atas akan fetch data.
  const sessionOk = await initAuth();
  if (!sessionOk) {
    // Belum login — view-login ditampilkan. Setelah user login,
    // SIGNED_IN → checkSession() → handleHashChange() akan dispatch
    // page-changed "hub" dan listener akan fetch data.
    return;
  }
}

// initDashboard() secara internal menunggu initAuth() → checkSession() sebelum fetch data
initDashboard().catch((err: unknown) => {
  console.error("Dashboard init failed:", err);
});
