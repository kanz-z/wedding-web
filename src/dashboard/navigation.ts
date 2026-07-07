// src/dashboard/navigation.ts
import { state } from './state';
import { loadOverview } from './overview';
import { loadTamuRSVP } from './tamu';
import { loadGuestbook } from './guestbook';
import { loadPesanPrivat, loadAdminList } from './pesan-admin';

export function switchTab(tabId: string): void {
  document.querySelectorAll('.tab-panel').forEach(function (p) {
    p.classList.remove('active');
  });
  document.querySelectorAll('.side-nav-menu a').forEach(function (a) {
    a.classList.remove('active');
  });
  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');
  const link = document.querySelector<HTMLElement>(
    '.side-nav-menu a[data-tab="' + tabId + '"]'
  );
  if (link) link.classList.add('active');
  if (tabId === 'tab-overview') loadOverview();
  if (tabId === 'tab-tamu') loadTamuRSVP();
  if (tabId === 'tab-guestbook') loadGuestbook();
  if (tabId === 'tab-pesan-privat') loadPesanPrivat();
  if (tabId === 'tab-admin') loadAdminList();
  if (state.sideNav) state.sideNav.classList.remove('open');
  if (state.overlay) state.overlay.classList.remove('open');
}

document.querySelectorAll('.side-nav-menu a').forEach(function (a) {
  a.addEventListener('click', function (this: HTMLElement, e: Event) {
    e.preventDefault();
    switchTab(this.dataset.tab ?? '');
  });
});

if (state.hamburger) {
  state.hamburger.addEventListener('click', function () {
    if (state.sideNav) state.sideNav.classList.toggle('open');
    if (state.overlay) state.overlay.classList.toggle('open');
  });
}
if (state.overlay) {
  state.overlay.addEventListener('click', function () {
    if (state.sideNav) state.sideNav.classList.remove('open');
    if (state.overlay) state.overlay.classList.remove('open');
  });
}
