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
  // Panggil initAuth() dulu — pastikan session valid sebelum query DB (RLS)
  const sessionOk = await initAuth();
  if (!sessionOk) return;

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

  // Fetch data tamu eagerly agar summary card di hub terisi sejak awal
  fetchGuests().then(() => {
    renderSummaryCards();
    renderNotifications();
  }).catch((err) => {
    console.warn("[dashboard] fetchGuests awal gagal", err);
  });

  // Init guest table pada first visit, reload data pada kunjungan berikutnya
  let guestTableInited = false;
  window.addEventListener("page-changed", ((e: CustomEvent) => {
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
}

// initDashboard() secara internal menunggu initAuth() → checkSession() sebelum fetch data
initDashboard().catch((err: unknown) => {
  console.error("Dashboard init failed:", err);
});
