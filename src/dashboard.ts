// entry point for dashboard.html

// CSS imports (bundled by Vite)
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/dashboard.css";

// Dashboard modules
import { initNavigation, initModals, initKeyboard } from "./dashboard/ui";
import { initGuestEvents } from "./dashboard/guests";
import { initAuth } from "./dashboard/auth";
import { initCheckinEvents } from "./dashboard/checkin";
import { initReservations } from "./dashboard/reservations";
import { initMessages } from "./dashboard/messages";
import { initAdmin } from "./dashboard/admin";

// Initialize all modules
function initDashboard(): void {
  initAuth();
  initNavigation();
  initModals();
  initKeyboard();
  initGuestEvents();
  initCheckinEvents();
  initReservations();
  initMessages();
  initAdmin();
}

initDashboard();
