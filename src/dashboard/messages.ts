// src/dashboard/messages.ts — Pesan Publik: visibility toggle

import { showToast } from '@/shared/ui';

export function initMessages(): void {
  document.querySelectorAll<HTMLInputElement>(".visibility-switch input").forEach((sw) => {
    sw.addEventListener("change", function () {
      showToast(this.checked ? "Ucapan ditampilkan ke publik" : "Ucapan disembunyikan dari publik");
    });
  });
}
