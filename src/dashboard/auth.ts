// src/dashboard/auth.ts
import { state } from './state';
import { showScreen, setLoginError, setLoginLoading } from './utils';
import { loadOverview } from './overview';
import { loadTamuRSVP } from './tamu';
import { loadGuestbook } from './guestbook';
import { loadCheckinLog } from './qr';

export async function verifyAdmin(user: { email?: string | null }): Promise<boolean> {
  try {
    const res: { data: unknown } = await state.dashboardSb.rpc('check_current_admin');
    return !!res.data;
  } catch {
    return false;
  }
}

function enterDashboard(user: { email?: string | null }): void {
  state.currentUser = user as { email: string };
  if (state.whoEmail) state.whoEmail.textContent = user.email || '';
  showScreen('dashboard');
  const qrEl = document.getElementById('qr-reader');
  if (qrEl) qrEl.classList.remove('scanner-active');
  loadOverview();
  loadTamuRSVP();
  loadGuestbook();
  loadCheckinLog();
}

export async function init(): Promise<void> {
  try {
    const sessionRes = await state.dashboardSb.auth.getSession();
    if (sessionRes.error) throw sessionRes.error;
    const session = sessionRes.data && sessionRes.data.session;
    if (session && session.user) {
      const isAdmin = await verifyAdmin(session.user);
      if (isAdmin) {
        enterDashboard(session.user);
        return;
      }
      await state.dashboardSb.auth.signOut();
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
  showScreen('login');
}

if (state.loginForm) {
  state.loginForm.addEventListener('submit', async function (e: Event) {
    e.preventDefault();
    setLoginError(null);
    const emailInput = document.getElementById('login-email') as HTMLInputElement | null;
    const passwordInput = document.getElementById('login-password') as HTMLInputElement | null;
    if (!emailInput || !passwordInput) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      setLoginError('Email dan password wajib diisi.');
      return;
    }
    setLoginLoading(true);
    try {
      const res = await state.dashboardSb.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (res.error) {
        setLoginError('Email atau password salah.');
        return;
      }
      const isAdmin = await verifyAdmin(res.data.user);
      if (!isAdmin) {
        await state.dashboardSb.auth.signOut();
        setLoginError('Akun ini belum terdaftar sebagai admin.');
        return;
      }
      (state.loginForm as HTMLFormElement).reset();
      enterDashboard(res.data.user);
    } catch (_err) {
      setLoginError('Tidak bisa terhubung ke server. Coba lagi.');
    } finally {
      setLoginLoading(false);
    }
  });
}

document.getElementById('logout-btn')?.addEventListener('click', async function () {
  const btn = this as HTMLButtonElement;
  btn.disabled = true;
  try {
    await state.dashboardSb.auth.signOut();
  } catch (_err) {
    /* ignore */
  }
  state.currentUser = null;
  btn.disabled = false;
  if (state.html5QrScanner) {
    const scanner = state.html5QrScanner as { stop: () => Promise<void> };
    scanner.stop().catch(function () { /* ignore */ });
    const qrEl = document.getElementById('qr-reader');
    if (qrEl) qrEl.classList.remove('scanner-active');
    state.html5QrScanner = null;
  }
  showScreen('login');
});
