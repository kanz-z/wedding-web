// src/dashboard/auth.ts — Supabase Auth: login, logout, session, route protection

import { showToast, show, hide } from '@/shared/ui';
import { supabase } from './supabase-client';
import { setCurrentAdmin } from './state';

const VALID_HASHES = new Set(['', 'hub', 'guests', 'checkin', 'reservations', 'private', 'public', 'admin']);

// --- Session check ---
export async function checkSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    show(document.getElementById("view-login"));
    hide(document.getElementById("view-app"));
    return false;
  }

  // Verify user is in admin_users table
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id, role")
    .eq("id", data.session.user.id)
    .maybeSingle();

  if (!adminRow) {
    await supabase.auth.signOut();
    show(document.getElementById("view-login"));
    hide(document.getElementById("view-app"));
    return false;
  }

  setCurrentAdmin(adminRow.role, adminRow.id);

  hide(document.getElementById("view-login"));
  show(document.getElementById("view-app"));
  handleHashChange();
  return true;
}

// --- Hash-based routing (3.2, 3.5) ---
function handleHashChange(): void {
  const hash = window.location.hash.replace('#', '') || 'hub';

  if (hash === 'login') return;

  if (!VALID_HASHES.has(hash)) {
    show404();
    return;
  }

  hide(document.getElementById("page-404"));

  document.querySelectorAll(".app-page").forEach((p) => p.classList.add("d-none-important"));
  const target = document.getElementById("page-" + hash);
  if (target) target.classList.remove("d-none-important");

  window.scrollTo({ top: 0, behavior: "auto" });
  window.dispatchEvent(new CustomEvent("page-changed", { detail: { page: hash } }));
}

function show404(): void {
  document.querySelectorAll(".app-page").forEach((p) => p.classList.add("d-none-important"));
  show(document.getElementById("page-404"));
}

export function navigateTo(hash: string): void {
  window.location.hash = hash;
}

function normalizeHash(raw: string): string {
  return raw.replace('#', '') || 'hub';
}

export function initAuth(): void {
  // 3.3 + 3.4: Route protection + session management
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      hide(document.getElementById("view-app"));
      show(document.getElementById("view-login"));
      (document.getElementById("login-form") as HTMLFormElement | null)?.reset();
      window.location.hash = '';
    }
    if (event === 'TOKEN_REFRESHED' && !session) {
      showToast("Sesi berakhir, silakan login kembali", true);
      hide(document.getElementById("view-app"));
      show(document.getElementById("view-login"));
      window.location.hash = '';
    }
    if (event === 'SIGNED_IN') {
      checkSession();
    }
  });

  // Listen for hash changes
  window.addEventListener("hashchange", () => {
    checkSession().catch(() => {});
  });

  // Login form (3.1)
  document.getElementById("login-form")?.addEventListener("submit", async function (e: Event) {
    e.preventDefault();

    // Rate limiting: max 5 percobaan dalam 30 detik
    const RL_KEY = "login_rl";
    const now = Date.now();
    const RL_WINDOW = 30_000;
    const RL_MAX = 5;

    function trackLoginFailure(): void {
      const raw = sessionStorage.getItem(RL_KEY);
      let rl: { count: number; first: number } | null = null;
      try { if (raw) rl = JSON.parse(raw); } catch { /* ignore */ }
      if (!rl || now - rl.first >= RL_WINDOW) {
        sessionStorage.setItem(RL_KEY, JSON.stringify({ count: 1, first: now }));
      } else {
        sessionStorage.setItem(RL_KEY, JSON.stringify({ count: rl.count + 1, first: rl.first }));
      }
    }

    const submitBtn = document.getElementById("login-submit") as HTMLButtonElement | null;
    const label = document.getElementById("login-submit-label");
    const spinner = document.getElementById("login-spinner");
    const errorBox = document.getElementById("login-error");
    const errorText = document.getElementById("login-error-text");

    function resetUI(): void {
      if (submitBtn) submitBtn.disabled = false;
      if (label) label.textContent = "Masuk";
      spinner?.classList.add("d-none-important");
    }

    try {
      const raw = sessionStorage.getItem(RL_KEY);
      let rl: { count: number; first: number } | null = null;
      try { if (raw) rl = JSON.parse(raw); } catch { /* ignore */ }
      if (rl && now - rl.first < RL_WINDOW && rl.count >= RL_MAX) {
        const wait = Math.ceil((RL_WINDOW - (now - rl.first)) / 1000);
        if (errorText) errorText.textContent = "Terlalu banyak percobaan. Coba lagi dalam " + wait + " detik.";
        show(errorBox);
        return;
      }

      const email = (document.getElementById("login-email") as HTMLInputElement | null)?.value.trim() ?? "";
      const pass = (document.getElementById("login-password") as HTMLInputElement | null)?.value.trim() ?? "";
      hide(errorBox);
      document.getElementById("field-email")?.classList.remove("has-error");
      document.getElementById("field-password")?.classList.remove("has-error");

      if (!email || !pass) {
        if (errorText) errorText.textContent = "Email dan kata sandi wajib diisi.";
        show(errorBox);
        if (!email) document.getElementById("field-email")?.classList.add("has-error");
        if (!pass) document.getElementById("field-password")?.classList.add("has-error");
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      if (label) label.textContent = "Memproses…";
      spinner?.classList.remove("d-none-important");

      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

      if (error) {
        if (errorText) errorText.textContent = "Email atau password tidak valid.";
        show(errorBox);
        document.getElementById("field-email")?.classList.add("has-error");
        document.getElementById("field-password")?.classList.add("has-error");
        trackLoginFailure();
        return;
      }

      // Verify user is in admin_users table
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!adminRow) {
        if (errorText) errorText.textContent = "Email atau password tidak valid.";
        show(errorBox);
        await supabase.auth.signOut();
        trackLoginFailure();
        return;
      }

      // Reset rate limit on success
      sessionStorage.removeItem(RL_KEY);

      navigateTo("hub");
    } catch (err) {
      if (errorText) errorText.textContent = "Terjadi kesalahan jaringan. Silakan coba lagi.";
      show(errorBox);
      console.error("Login error:", err);
    } finally {
      resetUI();
    }
  });

  // Forgot password
  document.getElementById("forgot-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    showToast("Hubungi superadmin untuk reset kata sandi");
  });

  // Logout (3.6)
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    // onAuthStateChange handles UI toggle
  });
}

// --- Init routing on dashboard load ---
export function initRouting(): void {
  // 3.2: Hash navigation via data attributes
  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => {
      const page = (el as HTMLElement).dataset.goto!;
      navigateTo(page);
    });
  });

  document.querySelectorAll("[data-back]").forEach((el) => {
    el.addEventListener("click", () => navigateTo("hub"));
  });
}
