// src/dashboard/ui.ts — navigation & shared UI (modals, toasts, notifications)

import { hide, show, toggle, prefersReducedMotion } from '@/shared/ui';
import { goToPage } from './guests';

// --- Notification ---
function closeNotifPanel(): void {
  const panel = document.getElementById("notif-panel");
  const btn = document.getElementById("btn-notif");
  panel?.classList.remove("show");
  btn?.setAttribute("aria-expanded", "false");
}

export function initNavigation(): void {
  // Page switching
  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => goToPage((el as HTMLElement).dataset.goto!));
  });
  document.querySelectorAll("[data-back]").forEach((el) => {
    el.addEventListener("click", () => goToPage("hub"));
  });

  // Notification panel
  const notifBtn = document.getElementById("btn-notif");
  const notifPanel = document.getElementById("notif-panel");
  notifBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    notifPanel?.classList.toggle("show");
    notifBtn?.setAttribute("aria-expanded", "true");
    document.getElementById("notif-dot")?.classList.add("d-none-important");
  });
  document.getElementById("notif-panel-close")?.addEventListener("click", closeNotifPanel);
  document.addEventListener("click", (e) => {
    if (notifPanel && !notifPanel.contains(e.target as Node) && e.target !== notifBtn) closeNotifPanel();
  });

  // Event status toggle
  document.getElementById("event-status-switch")?.addEventListener("change", function (this: HTMLInputElement) {
    const label = document.getElementById("event-status-label");
    if (!label) return;
    if (this.checked) { label.textContent = "Online"; label.className = "status-toggle__label is-online"; }
    else { label.textContent = "Offline"; label.className = "status-toggle__label is-offline"; }
  });
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
  const focusable = overlay.querySelector<HTMLElement>("button, [href], input, select, textarea");
  focusable?.focus();
}

export function hideModal(id: string): void {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add("is-closing");
  overlay.classList.remove("show");
  setTimeout(() => { overlay.style.display = "none"; overlay.classList.remove("is-closing"); }, prefersReducedMotion() ? 0 : 150);
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
    overlay.addEventListener("click", (e) => { if (e.target === overlay) hideModal(overlay.id); });
  });
}

export function initKeyboard(): void {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.show").forEach((o) => hideModal(o.id));
      document.getElementById("group-picker")?.classList.remove("show");
      closeNotifPanel();
    }
  });
}
