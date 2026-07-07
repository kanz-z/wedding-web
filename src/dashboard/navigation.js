import { state } from './state';
import { loadOverview } from './overview';
import { loadTamuRSVP } from './tamu';
import { loadGuestbook } from './guestbook';
import { loadPesanPrivat } from './pesan-admin';

export function switchTab(tabId) {
  document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.remove("active"); });
  document.querySelectorAll(".side-nav-menu a").forEach(function(a) { a.classList.remove("active"); });
  document.getElementById(tabId).classList.add("active");
  var link = document.querySelector('.side-nav-menu a[data-tab="' + tabId + '"]');
  if (link) link.classList.add("active");
  if (tabId === "tab-overview") loadOverview();
  if (tabId === "tab-tamu") loadTamuRSVP();
  if (tabId === "tab-guestbook") loadGuestbook();
  if (tabId === "tab-pesan-privat") loadPesanPrivat();
  if (tabId === "tab-admin") loadAdminList();
  state.sideNav.classList.remove("open");
  state.overlay.classList.remove("open");
}

document.querySelectorAll(".side-nav-menu a").forEach(function(a) {
  a.addEventListener("click", function(e) { e.preventDefault(); switchTab(this.dataset.tab); });
});

state.hamburger.addEventListener("click", function() { state.sideNav.classList.toggle("open"); state.overlay.classList.toggle("open"); });
state.overlay.addEventListener("click", function() { state.sideNav.classList.remove("open"); state.overlay.classList.remove("open"); });
