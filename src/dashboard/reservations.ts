// src/dashboard/reservations.ts — Reservasi page: search + copy link

import { showToast } from '@/shared/ui';

export function initReservations(): void {
  const resSearch = document.getElementById("res-search") as HTMLInputElement | null;
  resSearch?.addEventListener("input", function () {
    const q = this.value.trim().toLowerCase();
    document.getElementById("res-search-box")?.classList.toggle("has-value", !!q);
    document.querySelectorAll<HTMLElement>("#reservation-grid .reservation-card").forEach((card) => {
      card.style.display = (card.dataset.resName ?? "").includes(q) ? "" : "none";
    });
  });
  document.getElementById("res-search-clear")?.addEventListener("click", () => {
    if (resSearch) resSearch.value = "";
    document.getElementById("res-search-box")?.classList.remove("has-value");
    document.querySelectorAll<HTMLElement>("#reservation-grid .reservation-card").forEach((card) => { card.style.display = ""; });
  });
  document.querySelectorAll<HTMLElement>("[data-copy-link]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.dataset.copyLink ?? "";
      navigator.clipboard?.writeText(text).then(() => showToast("Tautan disalin")).catch(() => showToast("Gagal menyalin tautan", true));
    });
  });
}
