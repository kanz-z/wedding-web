// src/dashboard/checkin.ts — Check-in page: QR scanner, manual, log, mode toggle
// Fase 5: integrasi html5-qrcode sungguhan + halaman reservasi post-scan

import { Html5Qrcode } from 'html5-qrcode';
import { escapeHtml, formatTime, showToast, show, hide } from '@/shared/ui';
import { guestList, checkinStatus, fetchGuests } from './state';
import { supabase } from './supabase-client';
import type { GuestWithMeta } from './state';
import type { Reservation } from '@/types/supabase';

// --- QR Scanner State ---
let html5QrCode: Html5Qrcode | null = null;
let currentCameraId: string | null = null;
let isScanning = false;

const elementId = 'qr-reader';

// --- Camera management ---
async function getCameras(): Promise<{ id: string; label: string }[]> {
  try {
    const devices = await Html5Qrcode.getCameras();
    return devices.map((d) => ({ id: d.id, label: d.label || 'Kamera' }));
  } catch {
    return [];
  }
}

function findBackCamera(cameras: { id: string; label: string }[]): string | null {
  const back = cameras.find(
    (c) =>
      c.label.toLowerCase().includes('back') ||
      c.label.toLowerCase().includes('belakang') ||
      c.label.toLowerCase().includes('environment'),
  );
  return back?.id ?? cameras[0]?.id ?? null;
}

function findFrontCamera(cameras: { id: string; label: string }[]): string | null {
  const front = cameras.find(
    (c) =>
      c.label.toLowerCase().includes('front') ||
      c.label.toLowerCase().includes('depan') ||
      c.label.toLowerCase().includes('user'),
  );
  return front?.id ?? null;
}

// --- Scanner UI helpers ---
function setScannerStatus(text: string, isError?: boolean): void {
  const el = document.getElementById('scanner-status');
  if (!el) return;
  el.textContent = text;
  el.className = 'scanner-instruction' + (isError ? ' is-error' : '');
}

function showScannerView(): void {
  const frame = document.querySelector('.scanner-frame');
  const placeholder = frame?.querySelector<HTMLElement>('.scanner-placeholder');
  const qrDiv = document.getElementById(elementId);

  if (placeholder) hide(placeholder);
  if (qrDiv) show(qrDiv);

  if (!qrDiv && frame) {
    const div = document.createElement('div');
    div.id = elementId;
    div.style.width = '100%';
    div.style.aspectRatio = '1 / 1';
    frame.appendChild(div);
  }
}

function resetScannerView(): void {
  const frame = document.querySelector('.scanner-frame');
  const placeholder = frame?.querySelector<HTMLElement>('.scanner-placeholder');
  const qrDiv = document.getElementById(elementId);

  if (placeholder) show(placeholder);
  if (qrDiv) hide(qrDiv);

  const btn = document.getElementById('btn-start-scan') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-camera-fill"></i> Mulai Scan';
  }
  const switchBtn = document.getElementById('btn-switch-camera') as HTMLButtonElement | null;
  if (switchBtn) hide(switchBtn);

  isScanning = false;
}

// --- QR Code scanning ---
async function startScanner(): Promise<void> {
  const cameras = await getCameras();
  if (cameras.length === 0) {
    showToast('Tidak ada kamera terdeteksi. Gunakan check-in manual.', true);
    return;
  }

  const backId = findBackCamera(cameras);
  currentCameraId = backId ?? cameras[0].id;

  if (!html5QrCode) {
    let qrDiv = document.getElementById(elementId);
    if (!qrDiv) {
      qrDiv = document.createElement('div');
      qrDiv.id = elementId;
      qrDiv.style.width = '100%';
      qrDiv.style.aspectRatio = '1 / 1';
      const frame = document.querySelector('.scanner-frame');
      frame?.appendChild(qrDiv);
    }
    html5QrCode = new Html5Qrcode(elementId);
  }

  try {
    showScannerView();
    await html5QrCode.start(
      { deviceId: { exact: currentCameraId } },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
      },
      onScanSuccess,
      undefined,
    );
    isScanning = true;

    const btn = document.getElementById('btn-start-scan') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Memindai…';
    }

    const frontId = findFrontCamera(cameras);
    const switchBtn = document.getElementById('btn-switch-camera') as HTMLButtonElement | null;
    if (switchBtn && frontId) show(switchBtn);

    setScannerStatus('Arahkan kamera ke QR code tamu');
  } catch (err) {
    showToast('Gagal mengakses kamera. Periksa izin kamera.', true);
    resetScannerView();
  }
}

async function stopScanner(): Promise<void> {
  if (html5QrCode && isScanning) {
    try {
      await html5QrCode.stop();
    } catch {
      // already stopped
    }
  }
  resetScannerView();
}

async function switchCamera(): Promise<void> {
  const cameras = await getCameras();
  if (cameras.length < 2) return;

  const backId = findBackCamera(cameras);
  const frontId = findFrontCamera(cameras);
  const newCameraId = currentCameraId === backId ? frontId : backId;
  if (!newCameraId) return;

  currentCameraId = newCameraId;

  if (html5QrCode && isScanning) {
    await html5QrCode.stop();
    await html5QrCode.start(
      { deviceId: { exact: currentCameraId } },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
      onScanSuccess,
      undefined,
    );
  }
}

// --- Handle scan result ---
async function onScanSuccess(decodedText: string): Promise<void> {
  if (!isScanning) return;

  try { await html5QrCode?.pause(); } catch { /* ok */ }

  const qrToken = decodedText.trim();

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (error || !data) {
    addScanResult('QR tidak dikenal', false, 'QR code tidak terdaftar di database');
    setScannerStatus('QR tidak terdaftar — coba scan ulang', true);
    setTimeout(() => {
      setScannerStatus('Arahkan kamera ke QR code tamu');
      html5QrCode?.resume();
    }, 2000);
    return;
  }

  const reservation = data as Reservation;

  const { data: ciData } = await supabase
    .from('check_in_transactions')
    .select('delta')
    .eq('reservation_id', reservation.id);

  const checkedIn = (ciData || []).reduce((sum, t) => sum + (t.delta as number), 0);

  if (checkedIn >= reservation.guest_count) {
    addScanResult(reservation.name, true, `Sudah check-in ${checkedIn}/${reservation.guest_count}`);
    setScannerStatus('Tamu sudah check-in semua — coba scan lain', true);
    setTimeout(() => {
      setScannerStatus('Arahkan kamera ke QR code tamu');
      html5QrCode?.resume();
    }, 2000);
    return;
  }

  showPostScanModal(reservation, checkedIn);
}

// --- Post-scan modal (5.2) ---
function showPostScanModal(reservation: Reservation, checkedIn: number): void {
  const nameEl = document.getElementById('postscan-guest-name');
  const detailEl = document.getElementById('postscan-guest-detail');
  const bodyEl = document.getElementById('postscan-guest-body');
  const countEl = document.getElementById('postscan-checked-in-count');

  if (nameEl) nameEl.textContent = reservation.name;

  const remaining = reservation.guest_count - checkedIn;
  const isComplete = checkedIn >= reservation.guest_count;

  // GAP-012: Auto check-in untuk kuota 1 — langsung check-in tanpa modal
  if (reservation.guest_count === 1 && checkedIn === 0 && !isComplete) {
    const overlay = document.getElementById('postscan-modal-overlay');
    if (overlay) {
      overlay.dataset.reservationId = reservation.id;
      overlay.dataset.guestCount = String(reservation.guest_count);
      overlay.dataset.checkedIn = String(checkedIn);
    }
    doPostscanCheckinAll();
    return;
  }

  if (detailEl) {
    detailEl.textContent = isComplete
      ? `Sudah check-in: ${checkedIn}/${reservation.guest_count} — semua sudah hadir`
      : `Sudah check-in: ${checkedIn}/${reservation.guest_count} — sisa ${remaining}`;
  }

  if (countEl) {
    countEl.innerHTML = `<span class="mono-time">${checkedIn}</span><span style="color:var(--ink-muted)">/${reservation.guest_count}</span>`;
  }

  let html = '<dl class="detail-grid">';
  html += `<dt>Kelompok</dt><dd>${escapeHtml(reservation.kelompok || '–')}</dd>`;
  html += `<dt>Kategori</dt><dd>${reservation.kategori === 'keluarga' ? 'Keluarga' : 'Bukan Keluarga'}</dd>`;
  html += `<dt>No. WhatsApp</dt><dd>${escapeHtml(reservation.nomor_wa || '–')}</dd>`;
  html += `<dt>RSVP</dt><dd>${reservation.approval_status === 'approved' ? 'Hadir' : reservation.approval_status === 'rejected' ? 'Tidak Hadir' : 'Belum Respon'}</dd>`;
  if (reservation.notes) html += `<dt>Catatan</dt><dd>${escapeHtml(reservation.notes)}</dd>`;
  html += '</dl>';

  if (bodyEl) bodyEl.innerHTML = html;

  const allBtn = document.getElementById('postscan-btn-all') as HTMLButtonElement | null;
  const partialBtn = document.getElementById('postscan-btn-partial') as HTMLButtonElement | null;
  const partialInput = document.getElementById('postscan-partial-input') as HTMLInputElement | null;
  const allLabel = document.getElementById('postscan-all-label');

  if (allBtn) allBtn.disabled = isComplete;
  if (allLabel) allLabel.textContent = isComplete ? 'Semua sudah check-in' : `Masuk Semua (+${Math.max(1, remaining)})`;
  if (partialBtn) partialBtn.disabled = isComplete || remaining <= 0;
  if (partialInput) {
    partialInput.value = String(Math.max(1, remaining));
    partialInput.max = String(Math.max(1, remaining));
  }

  const overlay = document.getElementById('postscan-modal-overlay');
  if (overlay) {
    overlay.dataset.reservationId = reservation.id;
    overlay.dataset.guestCount = String(reservation.guest_count);
    overlay.dataset.checkedIn = String(checkedIn);
  }

  show(overlay);
}

// --- Post-scan actions ---
async function doPostscanCheckinAll(): Promise<void> {
  const overlay = document.getElementById('postscan-modal-overlay');
  const resId = overlay?.dataset.reservationId;
  if (!resId) return;

  const guestCount = parseInt(overlay?.dataset.guestCount ?? '0', 10);
  const checkedIn = parseInt(overlay?.dataset.checkedIn ?? '0', 10);
  const delta = guestCount - checkedIn;

  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    const resp = await fetch(
      `${import.meta.env.VITE_CHECK_IN_EDGE_FUNCTION}/check-in`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reservation_id: resId, delta, method: 'qr' }),
      },
    );

    const result = await resp.json();
    if (!resp.ok) { showToast(result.error || 'Gagal check-in', true); return; }

    hide(overlay);

    const guestName = (result as Record<string, unknown>).guest_name as string || 'Tamu';
    addScanResult(guestName, true, `Check-in +${delta} berhasil`);
    showToast(`${guestName} berhasil check-in (+${delta})`);

    await fetchGuests();
    window.dispatchEvent(new CustomEvent('checkin-updated'));
    html5QrCode?.resume();
  } catch (err: unknown) {
    showToast('Gagal: ' + (err instanceof Error ? err.message : String(err)), true);
  }
}

async function doPostscanCheckinPartial(): Promise<void> {
  const overlay = document.getElementById('postscan-modal-overlay');
  const resId = overlay?.dataset.reservationId;
  if (!resId) return;

  const input = document.getElementById('postscan-partial-input') as HTMLInputElement | null;
  const delta = parseInt(input?.value ?? '0', 10);
  if (!delta || delta < 1) { showToast('Jumlah tidak valid', true); return; }

  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    const resp = await fetch(
      `${import.meta.env.VITE_CHECK_IN_EDGE_FUNCTION}/check-in`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reservation_id: resId, delta, method: 'qr' }),
      },
    );

    const result = await resp.json();
    if (!resp.ok) { showToast(result.error || 'Gagal check-in', true); return; }

    hide(overlay);

    const guestName = (result as Record<string, unknown>).guest_name as string || 'Tamu';
    addScanResult(guestName, true, `Check-in +${delta} berhasil`);
    showToast(`${guestName} check-in (+${delta})`);

    await fetchGuests();
    window.dispatchEvent(new CustomEvent('checkin-updated'));
    html5QrCode?.resume();
  } catch (err: unknown) {
    showToast('Gagal: ' + (err instanceof Error ? err.message : String(err)), true);
  }
}

async function doPostscanOverride(): Promise<void> {
  const overlay = document.getElementById('postscan-modal-overlay');
  const resId = overlay?.dataset.reservationId;
  if (!resId) return;

  const guestCount = parseInt(overlay?.dataset.guestCount ?? '0', 10);
  const checkedIn = parseInt(overlay?.dataset.checkedIn ?? '0', 10);

  const overrideOverlay = document.getElementById('override-modal-overlay');
  const warnEl = document.getElementById('override-warning');
  const notesEl = document.getElementById('override-notes') as HTMLTextAreaElement | null;
  const inputEl = document.getElementById('override-delta') as HTMLInputElement | null;

  if (warnEl) warnEl.textContent = `Check-in melebihi kuota (${checkedIn}/${guestCount}). Masukkan jumlah tambahan dan alasan override.`;
  if (notesEl) notesEl.value = '';
  if (inputEl) { inputEl.value = '1'; inputEl.min = '1'; }
  if (overrideOverlay) overrideOverlay.dataset.reservationId = resId;

  show(overrideOverlay);
}

async function doPostscanOverrideConfirm(): Promise<void> {
  const overlay = document.getElementById('override-modal-overlay');
  const resId = overlay?.dataset.reservationId;
  if (!resId) return;

  const delta = parseInt((document.getElementById('override-delta') as HTMLInputElement)?.value ?? '0', 10);
  const notes = (document.getElementById('override-notes') as HTMLTextAreaElement)?.value.trim();

  if (!delta || delta < 1) { showToast('Jumlah tidak valid', true); return; }
  if (!notes) { showToast('Alasan override wajib diisi', true); return; }

  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    const resp = await fetch(
      `${import.meta.env.VITE_CHECK_IN_EDGE_FUNCTION}/check-in`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reservation_id: resId, delta, method: 'qr', is_override: true, notes }),
      },
    );

    const result = await resp.json();
    if (!resp.ok) { showToast(result.error || 'Gagal override', true); return; }

    hide(document.getElementById('postscan-modal-overlay'));
    hide(overlay);

    const guestName = (result as Record<string, unknown>).guest_name as string || 'Tamu';
    addScanResult(guestName, true, `Override +${delta} berhasil`);
    showToast(`${guestName} override check-in (+${delta})`);

    await fetchGuests();
    window.dispatchEvent(new CustomEvent('checkin-updated'));
    html5QrCode?.resume();
  } catch (err: unknown) {
    showToast('Gagal: ' + (err instanceof Error ? err.message : String(err)), true);
  }
}

function doPostscanViewLog(): void {
  const overlay = document.getElementById('postscan-modal-overlay');

  window.location.hash = 'checkin';
  setTimeout(() => {
    const adminBtn = document.querySelector<HTMLButtonElement>('.mode-toggle button[data-mode="admin"]');
    adminBtn?.click();
  }, 100);

  hide(overlay);
  html5QrCode?.resume();
}

function doPostscanEdit(): void {
  const overlay = document.getElementById('postscan-modal-overlay');
  const resId = overlay?.dataset.reservationId;
  if (!resId) return;

  hide(overlay);
  window.location.hash = 'guests';
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('open-edit-guest', { detail: { id: resId } }));
  }, 300);

  html5QrCode?.resume();
}

// --- Scan results panel (5.9) ---
interface ScanEntry {
  name: string;
  valid: boolean;
  message: string;
  time: string;
}

let scanHistory: ScanEntry[] = [];

export function addScanResult(name: string, valid: boolean, message?: string): void {
  const entry: ScanEntry = {
    name,
    valid,
    message: message || (valid ? 'Check-in berhasil' : 'QR tidak valid'),
    time: new Date().toISOString(),
  };
  scanHistory.unshift(entry);
  if (scanHistory.length > 3) scanHistory = scanHistory.slice(0, 3);
  renderScanResults();
}

function renderScanResults(): void {
  const list = document.getElementById('scan-results-list');
  if (!list) return;

  if (scanHistory.length === 0) {
    list.innerHTML = '<p style="color:var(--ink-muted);font-size:0.8125rem">Belum ada aktivitas scan pada sesi ini.</p>';
    return;
  }

  list.innerHTML = scanHistory
    .map(
      (entry) =>
        `<div class="scan-result-item${entry.valid ? '' : ' is-invalid'}">
          <div class="scan-result-item__icon"><i class="bi bi-${entry.valid ? 'check-lg' : 'x-lg'}"></i></div>
          <div>
            <div class="scan-result-item__name">${escapeHtml(entry.name)}</div>
            <div class="scan-result-item__meta">${escapeHtml(entry.message)} · ${formatTime(entry.time)}</div>
          </div>
        </div>`,
    )
    .join('');
}

// --- Check-in log (admin mode) ---
export function renderCheckinLog(): void {
  const checked = guestList
    .filter(g => g.checkedInAt)
    .sort((a, b) => new Date(b.checkedInAt ?? 0).getTime() - new Date(a.checkedInAt ?? 0).getTime());
  const el = document.getElementById('checkin-log-list');
  if (!el) return;
  el.innerHTML = checked.length
    ? checked
        .map(
          (g) =>
            `<div class="scan-result-item">
              <div class="scan-result-item__icon"><i class="bi bi-clock-history"></i></div>
              <div style="flex:1">
                <div class="scan-result-item__name">${escapeHtml(g.name)}</div>
                <div class="scan-result-item__meta">${g.checkedIn}/${g.guest_count} tamu · ${formatTime(g.checkedInAt)}</div>
              </div>
            </div>`,
        )
        .join('')
    : '<p style="color:var(--ink-muted);font-size:.8125rem;">Belum ada riwayat check-in.</p>';
}

// --- Init check-in events ---
export function initCheckinEvents(): void {
  // Mode toggle (5.8)
  document.querySelectorAll('.mode-toggle button').forEach((btn) =>
    btn.addEventListener('click', function (this: HTMLButtonElement) {
      document.querySelectorAll('.mode-toggle button').forEach((b) => b.classList.remove('active'));
      this.classList.add('active');
      if (this.dataset.mode === 'scan') {
        show(document.getElementById('checkin-mode-scan'));
        hide(document.getElementById('checkin-mode-admin'));
      } else {
        hide(document.getElementById('checkin-mode-scan'));
        show(document.getElementById('checkin-mode-admin'));
        renderCheckinLog();
        stopScanner();
      }
    }),
  );

  // Start/stop scan
  document.getElementById('btn-start-scan')?.addEventListener('click', () => {
    isScanning ? stopScanner() : startScanner();
  });

  // Switch camera
  document.getElementById('btn-switch-camera')?.addEventListener('click', () => switchCamera());

  // Post-scan modal close
  document.getElementById('postscan-modal-overlay')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).dataset.modalClose !== undefined ||
        (e.target as HTMLElement).id === 'postscan-modal-overlay') {
      hide(document.getElementById('postscan-modal-overlay'));
      html5QrCode?.resume();
    }
  });

  // Post-scan buttons
  document.getElementById('postscan-btn-all')?.addEventListener('click', doPostscanCheckinAll);
  document.getElementById('postscan-btn-partial')?.addEventListener('click', doPostscanCheckinPartial);
  document.getElementById('postscan-btn-override')?.addEventListener('click', doPostscanOverride);
  document.getElementById('postscan-btn-log')?.addEventListener('click', doPostscanViewLog);
  document.getElementById('postscan-btn-edit')?.addEventListener('click', doPostscanEdit);
  document.getElementById('postscan-btn-close')?.addEventListener('click', () => {
    hide(document.getElementById('postscan-modal-overlay'));
    html5QrCode?.resume();
  });

  // Override modal
  document.getElementById('override-modal-overlay')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).dataset.modalClose !== undefined ||
        (e.target as HTMLElement).id === 'override-modal-overlay') {
      hide(document.getElementById('override-modal-overlay'));
    }
  });
  document.getElementById('override-confirm-btn')?.addEventListener('click', doPostscanOverrideConfirm);
  document.getElementById('override-cancel-btn')?.addEventListener('click', () => {
    hide(document.getElementById('override-modal-overlay'));
  });

  // Manual check-in (5.7)
  document.getElementById('btn-toggle-manual')?.addEventListener('click', () =>
    document.getElementById('manual-search-panel')?.classList.toggle('d-none-important'));

  const mi = document.getElementById('manual-checkin-search') as HTMLInputElement | null;
  mi?.addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    const r = document.getElementById('manual-checkin-results');
    if (!r) return;
    if (!q) { r.innerHTML = ''; return; }
    const matches = guestList
      .filter((g) => checkinStatus(g) !== 'sudah' && (g.name.toLowerCase().includes(q) || (g.nomor_wa ?? '').includes(q)))
      .slice(0, 3);
    r.innerHTML = matches.length
      ? matches
          .map(
            (g) =>
              `<div class="manual-result-item">
                <span>${escapeHtml(g.name)} ${g.kelompok ? `<span style="color:var(--ink-muted);font-size:0.75rem">(${escapeHtml(g.kelompok)})</span>` : ''}</span>
                <button type="button" data-manual-checkin="${g.id}">Check-in</button>
              </div>`,
          )
          .join('')
      : '<p style="color:var(--ink-muted);font-size:.8125rem;">Tidak ditemukan tamu yang cocok.</p>';
  });

  document.getElementById('manual-checkin-results')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-manual-checkin]');
    if (!btn) return;
    const id = btn.dataset.manualCheckin!;
    if (mi) mi.value = '';
    const r = document.getElementById('manual-checkin-results');
    if (r) r.innerHTML = '';
    // Dispatch to open check-in dialog (handled by guests.ts)
    window.dispatchEvent(new CustomEvent('open-checkin-dialog', { detail: { id } }));
  });

  // Page change — stop scanner
  window.addEventListener('page-changed', ((e: CustomEvent) => {
    if (e.detail.page !== 'checkin' && isScanning) stopScanner();
    if (e.detail.page === 'checkin') renderCheckinLog();
  }) as EventListener);

  window.addEventListener('checkin-updated', () => {
    renderCheckinLog();
    renderScanResults();
  });

  renderScanResults();
}
