// src/dashboard/checkin.ts — Check-in page: scanner, manual, log, mode toggle
// Fase 4: pakai guestList dari state

import { escapeHtml, formatTime, showToast, show, hide } from '@/shared/ui';
import { guestList, checkinStatus } from './state';

export function addScanResult(name: string, valid: boolean): void {
  const list = document.getElementById('scan-results-list');
  if (!list) return;
  if (list.children.length === 1 && (list.children[0] as HTMLElement).tagName === 'P') list.innerHTML = '';
  const item = document.createElement('div');
  item.className = 'scan-result-item' + (valid ? '' : ' is-invalid');
  item.innerHTML = `<div class="scan-result-item__icon"><i class="bi bi-${valid ? 'check-lg' : 'x-lg'}"></i></div><div><div class="scan-result-item__name">${escapeHtml(name)}</div><div class="scan-result-item__meta">${valid ? 'Check-in berhasil' : 'QR tidak valid'} · ${formatTime(new Date().toISOString())}</div></div>`;
  list.prepend(item);
  while (list.children.length > 3 && list.lastChild) list.removeChild(list.lastChild);
  showToast(valid ? name + ' berhasil check-in' : 'QR tidak valid, coba scan ulang', !valid);
}

export function renderCheckinLog(): void {
  const checked = guestList
    .filter(g => g.checkedInAt)
    .sort((a, b) => new Date(b.checkedInAt ?? 0).getTime() - new Date(a.checkedInAt ?? 0).getTime());
  const el = document.getElementById('checkin-log-list');
  if (!el) return;
  el.innerHTML = checked.length
    ? checked
        .map(g =>
          `<div class="scan-result-item"><div class="scan-result-item__icon"><i class="bi bi-clock-history"></i></div><div style="flex:1"><div class="scan-result-item__name">${escapeHtml(g.name)}</div><div class="scan-result-item__meta">${g.checkedIn}/${g.guest_count} tamu · ${formatTime(g.checkedInAt)}</div></div></div>`)
        .join('')
    : '<p style="color:var(--ink-muted);font-size:.8125rem;">Belum ada riwayat check-in.</p>';
}

export function initCheckinEvents(): void {
  document.querySelectorAll('.mode-toggle button').forEach(btn =>
    btn.addEventListener('click', function (this: HTMLButtonElement) {
      document.querySelectorAll('.mode-toggle button').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      if (this.dataset.mode === 'scan') {
        show(document.getElementById('checkin-mode-scan'));
        hide(document.getElementById('checkin-mode-admin'));
      } else {
        hide(document.getElementById('checkin-mode-scan'));
        show(document.getElementById('checkin-mode-admin'));
        renderCheckinLog();
      }
    }),
  );

  document.getElementById('btn-start-scan')?.addEventListener('click', function (this: HTMLButtonElement) {
    this.disabled = true;
    this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Membuka kamera…';
    setTimeout(() => {
      this.disabled = false;
      this.innerHTML = '<i class="bi bi-camera-fill"></i> Mulai Scan';
      const candidates = guestList.filter(g => g.rsvp === 'hadir' && checkinStatus(g) !== 'sudah');
      if (!candidates.length) { showToast('Semua tamu RSVP hadir sudah check-in', true); return; }
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      addScanResult(picked.name, true);
      window.dispatchEvent(new CustomEvent('checkin-updated'));
    }, 1200);
  });

  document.getElementById('btn-toggle-manual')?.addEventListener('click', () =>
    document.getElementById('manual-search-panel')?.classList.toggle('d-none-important'));

  const mi = document.getElementById('manual-checkin-search') as HTMLInputElement | null;
  mi?.addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    const r = document.getElementById('manual-checkin-results');
    if (!r) return;
    if (!q) { r.innerHTML = ''; return; }
    const matches = guestList
      .filter(g => checkinStatus(g) !== 'sudah' && (g.name.toLowerCase().includes(q) || (g.nomor_wa ?? '').includes(q)))
      .slice(0, 3);
    r.innerHTML = matches.length
      ? matches.map(g => `<div class="manual-result-item"><span>${escapeHtml(g.name)}</span><button type="button" data-manual-checkin="${g.id}">Check-in</button></div>`).join('')
      : '<p style="color:var(--ink-muted);font-size:.8125rem;">Tidak ditemukan tamu yang cocok.</p>';
  });

  document.getElementById('manual-checkin-results')?.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-manual-checkin]');
    if (!btn) return;
    const id = btn.dataset.manualCheckin!;
    const g = guestList.find(x => x.id === id);
    if (!g) return;
    addScanResult(g.name, true);
    if (mi) mi.value = '';
    const r = document.getElementById('manual-checkin-results');
    if (r) r.innerHTML = '';
    window.dispatchEvent(new CustomEvent('checkin-updated'));
  });

  window.addEventListener('checkin-updated', renderCheckinLog);
}
