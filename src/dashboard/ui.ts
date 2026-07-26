// src/dashboard/ui.ts — shared UI: modals, notifications, keyboard

import { hide, show, prefersReducedMotion, formatRelativeTime } from "@/shared/ui";
import { guestList, guestbookEntries, getAnomalyCount } from "./state";

/** Entry notifikasi sederhana */
export interface NotificationItem {
  id: string;
  icon: string;
  message: string;
  time: string;
  flagged: boolean;
}

/**
 * Bangun notifikasi dari data nyata:
 * - Tamu dengan anomali (flagged)
 * - RSVP pending
 * - Guestbook baru
 */
export function renderNotifications(): void {
  const list = document.getElementById("notif-list");
  const empty = document.getElementById("notif-empty");
  if (!list || !empty) return;

  const items: NotificationItem[] = [];

  // Anomali tamu
  for (const g of guestList) {
    if (g.flag) {
      items.push({
        id: "anom-" + g.id,
        icon: "bi-flag-fill",
        message: "<strong>" + g.name + "</strong>: " + g.flag,
        time: g.updated_at ?? g.created_at,
        flagged: true,
      });
    }
  }

  // RSVP pending
  for (const g of guestList) {
    if (g.approval_status === "pending") {
      items.push({
        id: "rsvp-" + g.id,
        icon: "bi-envelope-heart-fill",
        message:
          "<strong>" +
          g.name +
          "</strong> mengisi RSVP — menunggu persetujuan.",
        time: g.updated_at ?? g.created_at,
        flagged: false,
      });
    }
  }

  // Guestbook terbaru (maks 5)
  const recentGb = guestbookEntries.slice(0, 5);
  for (const entry of recentGb) {
    items.push({
      id: "gb-" + entry.id,
      icon: "bi-chat-heart-fill",
      message:
        "<strong>" +
        entry.name +
        "</strong> mengirim ucapan baru di guestbook.",
      time: entry.created_at,
      flagged: false,
    });
  }

  // Urutkan: flagged dulu, lalu terbaru
  items.sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    return (b.time || "").localeCompare(a.time || "");
  });

  // Render
  if (items.length === 0) {
    list.innerHTML = "";
    empty.style.display = "";
    return;
  }

  empty.style.display = "none";
  list.innerHTML = items
    .map(function (item) {
      const iconClass = item.flagged ? "notif-item is-flagged" : "notif-item";
      const timeStr = formatRelativeTime(item.time);
      return (
        '<div class="' +
        iconClass +
        '">' +
        '<div class="notif-item__icon"><i class="bi ' +
        item.icon +
        '"></i></div>' +
        '<div class="notif-item__body"><p>' +
        item.message +
        "</p>" +
        '<span class="notif-item__time">' +
        timeStr +
        "</span></div>" +
        "</div>"
      );
    })
    .join("");

  // Update dot
  const dot = document.getElementById("notif-dot");
  if (dot) {
    const anom = getAnomalyCount();
    if (anom > 0) {
      dot.classList.remove("d-none-important");
    } else {
      dot.classList.add("d-none-important");
    }
  }
}


// --- Notification ---
function closeNotifPanel(): void {
  const panel = document.getElementById("notif-panel");
  const btn = document.getElementById("btn-notif");
  const overlay = document.getElementById("notif-overlay");
  panel?.classList.remove("show");
  overlay?.classList.remove("show");
  btn?.setAttribute("aria-expanded", "false");
}

export function initNotifications(): void {
  const notifBtn = document.getElementById("btn-notif");
  const notifPanel = document.getElementById("notif-panel");
  const notifOverlay = document.getElementById("notif-overlay");

  notifBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = notifPanel?.classList.toggle("show");
    notifBtn?.setAttribute("aria-expanded", String(!!isOpen));
    notifOverlay?.classList.toggle(
      "show",
      !!isOpen && notifPanel?.classList.contains("show"),
    );
    if (isOpen) {
      document.getElementById("notif-dot")?.classList.add("d-none-important");
    }
  });

  document
    .getElementById("notif-panel-close")
    ?.addEventListener("click", closeNotifPanel);

  // Tap overlay → tutup drawer mobile
  notifOverlay?.addEventListener("click", closeNotifPanel);

  // Tap di luar panel → tutup
  document.addEventListener("click", (e) => {
    if (
      notifPanel &&
      !notifPanel.contains(e.target as Node) &&
      e.target !== notifBtn
    ) {
      closeNotifPanel();
    }
  });

  document
    .getElementById("event-status-switch")
    ?.addEventListener("change", function (this: HTMLInputElement) {
      const label = document.getElementById("event-status-label");
      if (!label) return;
      if (this.checked) {
        label.textContent = "Online";
        label.className = "status-toggle__label is-online";
      } else {
        label.textContent = "Offline";
        label.className = "status-toggle__label is-offline";
      }
    });

  // Render notifikasi awal
  renderNotifications();
}

// --- Modal helpers ---
let lastFocusedTrigger: Element | null = null;

export function showModal(id: string): void {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  lastFocusedTrigger = document.activeElement;
  overlay.classList.remove("is-closing");
  overlay.style.display = "flex";
  void overlay.offsetWidth;
  overlay.classList.add("show");
  const focusable = overlay.querySelector<HTMLElement>(
    "button, [href], input, select, textarea",
  );
  focusable?.focus();
}

export function hideModal(id: string): void {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add("is-closing");
  overlay.classList.remove("show");
  setTimeout(
    () => {
      overlay.style.display = "none";
      overlay.classList.remove("is-closing");
    },
    prefersReducedMotion() ? 0 : 150,
  );
  if (lastFocusedTrigger instanceof HTMLElement) lastFocusedTrigger.focus();
}

export function initModals(): void {
  document.querySelectorAll("[data-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const overlay = (btn as HTMLElement).closest(".modal-overlay");
      if (overlay) hideModal(overlay.id);
    });
  });
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) hideModal(overlay.id);
    });
  });
}

export function initKeyboard(): void {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".modal-overlay.show")
        .forEach((o) => hideModal(o.id));
      document.getElementById("group-picker")?.classList.remove("show");
      closeNotifPanel();
    }
  });
}
