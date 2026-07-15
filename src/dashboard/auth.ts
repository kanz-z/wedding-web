// src/dashboard/auth.ts — login & logout

import { showToast, show, hide } from '@/shared/ui';
import { goToPage } from './guests';

export function initAuth(): void {
  document.getElementById("login-form")?.addEventListener("submit", function (e: Event) {
    e.preventDefault();
    const email = (document.getElementById("login-email") as HTMLInputElement | null)?.value.trim() ?? "";
    const pass = (document.getElementById("login-password") as HTMLInputElement | null)?.value.trim() ?? "";
    const errorBox = document.getElementById("login-error"); hide(errorBox);
    document.getElementById("field-email")?.classList.remove("has-error"); document.getElementById("field-password")?.classList.remove("has-error");

    if (!email || !pass) {
      const et = document.getElementById("login-error-text"); if (et) et.textContent = "Email atau password tidak valid."; show(errorBox);
      if (!email) document.getElementById("field-email")?.classList.add("has-error");
      if (!pass) document.getElementById("field-password")?.classList.add("has-error");
      return;
    }
    const submitBtn = document.getElementById("login-submit") as HTMLButtonElement | null; if (submitBtn) submitBtn.disabled = true;
    const label = document.getElementById("login-submit-label"); if (label) label.textContent = "Memproses…";
    document.getElementById("login-spinner")?.classList.remove("d-none-important");

    // TODO: Supabase Auth di Fase 3
    setTimeout(() => {
      if (submitBtn) submitBtn.disabled = false; if (label) label.textContent = "Masuk";
      document.getElementById("login-spinner")?.classList.add("d-none-important");
      hide(document.getElementById("view-login")); show(document.getElementById("view-app")); goToPage("hub");
    }, 700);
  });

  document.getElementById("forgot-link")?.addEventListener("click", (e) => { e.preventDefault(); showToast("Hubungi superadmin untuk reset kata sandi"); });
  document.getElementById("btn-logout")?.addEventListener("click", () => {
    hide(document.getElementById("view-app")); show(document.getElementById("view-login"));
    (document.getElementById("login-form") as HTMLFormElement | null)?.reset(); document.getElementById("login-email")?.focus();
  });
}
