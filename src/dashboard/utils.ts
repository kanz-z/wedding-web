// src/dashboard/utils.ts
import { state } from './state';

export function showScreen(name: string): void {
  if (state.loginScreen) state.loginScreen.classList.toggle('active', name === 'login');
  if (state.dashScreen) state.dashScreen.classList.toggle('active', name === 'dashboard');
}

export function showToast(message: string, isError?: boolean): void {
  clearTimeout(state.toastTimer ?? undefined);
  if (state.toastEl) {
    state.toastEl.textContent = message;
    state.toastEl.classList.toggle('error', !!isError);
    state.toastEl.classList.add('show');
    state.toastTimer = setTimeout(function () {
      if (state.toastEl) state.toastEl.classList.remove('show');
    }, 3200);
  }
}

export function setLoginError(message: string | null): void {
  if (state.loginError) {
    state.loginError.textContent = message || '';
    state.loginError.classList.toggle('show', !!message);
  }
}

export function setLoginLoading(isLoading: boolean): void {
  if (state.loginSubmit) {
    (state.loginSubmit as HTMLButtonElement).disabled = isLoading;
    state.loginSubmit.textContent = isLoading ? 'Memproses…' : 'Masuk';
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    } as Intl.DateTimeFormatOptions);
  } catch (_e) {
    return iso;
  }
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_e) {
    return iso;
  }
}

export function escapeHtml(str: string): string {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

export function escapeAttr(str: string): string {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic debounce
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return function (this: unknown, ...args: Parameters<T>) {
    const ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(ctx, args);
    }, ms);
  };
}
