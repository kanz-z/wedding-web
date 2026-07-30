// src/dashboard/ui.ts — shared UI: modals, notifications, keyboard

import { hide, prefersReducedMotion, formatRelativeTime } from "@/shared/ui";
import { guestList, getAnomalyCount } from "./state";
import { supabase } from "./supabase-client";

/** Category → icon mapping (satu sumber kebenaran) */
const CATEGORY_ICON: Record<string, string> = {
  anomaly: "bi-flag-fill",
  rsvp_pending: "bi-envelope-heart-fill",
  new_guestbook: "bi-chat-heart-fill",
  new_reservation: "bi-person-plus-fill",
  checkin: "bi-qr-code",
  rsvp_approved: "bi-check-circle-fill",
  rsvp_rejected: "bi-x-circle-fill",
};

const CATEGORY_IS_FLAGGED: Record<string, boolean> = {
  anomaly: true,
  rsvp_pending: false,
  new_guestbook: false,
  new_reservation: false,
  checkin: false,
  rsvp_approved: false,
  rsvp_rejected: true,
};

/** Entry notifikasi dari tabel notifications + anomali client-side */
export interface NotificationItem {
  id: string;
  category: string;
  message: string;
  created_at: string;
  is_read: boolean;
  related_table: string | null;
  related_id: string | null;
}

/**
 * Render notifikasi dari kombinasi:
 * - Tabel `notifications` (trigger DB)
 * - Anomali client-side dari guestList (flag adalah computed field)
 */
export async function renderNotifications(): Promise<void> {
  const list = document.getElementById("notif-list");
  const empty = document.getElementById("notif-empty");
  if (!list || !empty) return;

  const items: NotificationItem[] = [];

  // 1. Notifikasi dari tabel (trigger DB)
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!error && data) {
    for (const row of data) {
      items.push({
        id: row.id,
        category: row.category,
        message: row.message,
        created_at: row.created_at,
        is_read: row.is_read,
        related_table: row.related_table,
        related_id: row.related_id,
      });
    }
  }

  // 2. Anomali client-side (flag adalah computed field, tidak bisa via trigger DB)
  for (const g of guestList) {
    if (g.flag) {
      const exists = items.some(function (item) {
        return item.category === "anomaly" && item.related_id === g.id;
      });
      if (!exists) {
        items.push({
          id: "anom-" + g.id,
          category: "anomaly",
          message: "<strong>" + g.name +
            "</strong>: " + g.flag,
          created_at: g.updated_at ?? g.created_at,
          is_read: false,
          related_table: "guests",
          related_id: g.id,
        });
      }
    }
  }

  // Urutkan: flagged dulu, lalu terbaru
  items.sort(function (a, b) {
    const aFlag = CATEGORY_IS_FLAGGED[a.category] ?? false;
    const bFlag = CATEGORY_IS_FLAGGED[b.category] ?? false;
    if (aFlag !== bFlag) return aFlag ? -1 : 1;
    return (b.created_at || "").localeCompare(a.created_at || "");
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
      const isFlagged = CATEGORY_IS_FLAGGED[item.category] ?? false;
      const iconClass = isFlagged ? "notif-item is-flagged" : "notif-item";
      const icon = CATEGORY_ICON[item.category] ?? "bi-bell";
      const timeStr = formatRelativeTime(item.created_at);
      return (
        '<div class="' +
        iconClass +
        '" data-notif-id="' + item.id + '">' +
        '<div class="notif-item__icon"><i class="bi ' +
        icon +
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

  // Update dot: anomali + notifikasi unread
  updateNotifDot();
}

/** Update dot merah berdasarkan anomali + notifikasi unread */
async function updateNotifDot(): Promise<void> {
  const dot = document.getElementById("notif-dot");
  if (!dot) return;

  // Anomali client-side
  const anom = getAnomalyCount();

  // Unread dari tabel
  let unreadCount = 0;
  const { error: e, count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (!e && count !== null) {
    unreadCount = count;
  }

  if (anom > 0 || unreadCount > 0) {
    dot.classList.remove("d-none-important");
  } else {
    dot.classList.add("d-none-important");
  }
}

/** Mark notifikasi dari tabel sebagai read */
async function markNotificationsRead(): Promise<void> {
  // Ambil ID notifikasi unread yang dirender di panel
  const items = document.querySelectorAll<HTMLElement>("#notif-list .notif-item[data-notif-id]");
  const ids: string[] = [];
  items.forEach(function (el) {
    const id = el.getAttribute("data-notif-id");
    if (id && !id.startsWith("anom-")) {
      ids.push(id);
    }
  });
  if (ids.length === 0) return;

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .in("id", ids);
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
      markNotificationsRead();
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
      if (e.target === overlay) {
        if ((overlay as HTMLElement).dataset.preventClose === "true") return;
        hideModal(overlay.id);
      }
    });
  });
}

export function initKeyboard(): void {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".modal-overlay.show")
        .forEach((o) => {
          if ((o as HTMLElement).dataset.preventClose === "true") return;
          hideModal(o.id);
        });
      document.getElementById("group-picker")?.classList.remove("show");
      closeNotifPanel();
    }
  });
}
