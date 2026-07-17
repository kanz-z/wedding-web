// entry point for dashboard.html

// CSS imports (bundled by Vite)
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/dashboard.css";

// Dashboard modules
import { initNotifications, initModals, initKeyboard } from "./dashboard/ui";
import { initGuestEvents, initGuestTable, reloadGuests } from "./dashboard/guests";
import { initAuth, initRouting, checkSession } from "./dashboard/auth";
import { initCheckinEvents, renderCheckinLog } from "./dashboard/checkin";
import { initReservations } from "./dashboard/reservations";
import { initMessages } from "./dashboard/messages";
import { initAdmin } from "./dashboard/admin";

// Initialize all modules
function initDashboard(): void {
  initAuth();
  initRouting();
  initNotifications();
  initModals();
  initKeyboard();
  initGuestEvents();
  initCheckinEvents();
  initReservations();
  initMessages();
  initAdmin();

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

// Check session on load — redirect to login if no session
checkSession().then(() => initDashboard());
