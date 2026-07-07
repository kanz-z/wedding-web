// src/dashboard/qr.ts
import { state } from './state';
import { showToast, escapeHtml, formatTime, debounce } from './utils';
import { loadTamuRSVP } from './tamu';

// html5-qrcode global (no TS types available)
declare class Html5Qrcode {
  constructor(elementId: string);
  start(
    config: { facingMode: string },
    qrbox: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (text: string) => void,
    onError: (err: unknown) => void
  ): Promise<void>;
  stop(): Promise<void>;
}

export function startScanner(): void {
  const resultEl = document.getElementById('scan-result') as HTMLElement | null;
  if (resultEl) {
    resultEl.className = 'scan-result';
    resultEl.textContent = '';
  }
  if (!state.html5QrScanner) {
    state.html5QrScanner = new Html5Qrcode('qr-reader');
  }
  const btnStart = document.getElementById('btn-start-scan');
  const btnStop = document.getElementById('btn-stop-scan');
  if (btnStart) btnStart.classList.add('d-none');
  if (btnStop) btnStop.classList.remove('d-none');
  (state.html5QrScanner as Html5Qrcode)
    .start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      function (err: unknown) {
        console.debug('QR scan error (non-fatal):', err);
      }
    )
    .catch(function (err: unknown) {
      showToast('Gagal mengakses kamera: ' + err, true);
      if (btnStart) btnStart.classList.remove('d-none');
      if (btnStop) btnStop.classList.add('d-none');
    });
  const qrEl = document.getElementById('qr-reader');
  if (qrEl) qrEl.classList.add('scanner-active');
}

export function stopScanner(): void {
  if (state.html5QrScanner) {
    (state.html5QrScanner as Html5Qrcode)
      .stop()
      .then(function () {
        const btnStart = document.getElementById('btn-start-scan');
        const btnStop = document.getElementById('btn-stop-scan');
        if (btnStart) btnStart.classList.remove('d-none');
        if (btnStop) btnStop.classList.add('d-none');
        const qrEl = document.getElementById('qr-reader');
        if (qrEl) qrEl.classList.remove('scanner-active');
      })
      .catch(function () {});
  }
}

interface ScanTamu {
  id: string;
  nama: string;
  checked_in: boolean;
  jumlah_hadir: number;
}

async function onScanSuccess(decodedText: string): Promise<void> {
  const resultEl = document.getElementById('scan-result') as HTMLElement | null;
  const raw = decodedText.trim();
  let token = raw;
  try {
    const url = new URL(raw);
    const maybe = url.searchParams.get('token');
    if (maybe) token = maybe;
  } catch (_e) {
    /* not a URL, use raw text as token */
  }
  try {
    const res = await state.dashboardSb
      .from('rsvps')
      .select('id, nama, checked_in, jumlah_hadir')
      .eq('qr_token', token)
      .single();
    if (res.error || !res.data) {
      if (resultEl) {
        resultEl.className = 'scan-result error';
        resultEl.textContent = 'Tamu tidak terdaftar';
      }
      stopScanner();
      return;
    }
    const tamu = res.data as ScanTamu;
    if (tamu.checked_in) {
      const checkinRes = await state.dashboardSb
        .from('guest_checkins')
        .select('checked_in_at')
        .eq('rsvp_id', tamu.id)
        .single();
      const time = checkinRes.data
        ? formatTime((checkinRes.data as Record<string, string>).checked_in_at)
        : 'sebelumnya';
      if (resultEl) {
        resultEl.className = 'scan-result info';
        resultEl.textContent = escapeHtml(tamu.nama) + ' - Sudah check-in pukul ' + time;
      }
      stopScanner();
      return;
    }
    await state.dashboardSb
      .from('guest_checkins')
      .insert([{ rsvp_id: tamu.id, method: 'qr', guest_count_actual: tamu.jumlah_hadir }]);
    await state.dashboardSb.from('rsvps').update({ checked_in: true }).eq('id', tamu.id);
    if (resultEl) {
      resultEl.className = 'scan-result success';
      resultEl.textContent =
        escapeHtml(tamu.nama) + ' - Check-in berhasil! (' + tamu.jumlah_hadir + ' org)';
    }
    stopScanner();
    loadCheckinLog();
    loadTamuRSVP();
  } catch (err) {
    console.error('Scan error:', err);
    if (resultEl) {
      resultEl.className = 'scan-result error';
      resultEl.textContent = 'Gagal memproses check-in';
    }
    stopScanner();
  }
}

const doManualSearch = debounce(async function (): Promise<void> {
  const q = (document.getElementById('manual-search') as HTMLInputElement | null)?.value?.trim() || '';
  const results = document.getElementById('manual-results');
  if (results) results.innerHTML = '';
  if (q.length < 2) return;
  try {
    const res = await state.dashboardSb
      .from('rsvps')
      .select('id, nama, checked_in, jumlah_hadir, status')
      .ilike('nama', '%' + q + '%')
      .limit(10);
    if (res.error) throw res.error;
    const data = (res.data || []) as Array<{
      id: string;
      nama: string;
      checked_in: boolean;
      jumlah_hadir: number;
      status: string | null;
    }>;
    if (results) {
      data.forEach(function (t) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML =
          '<span>' +
          escapeHtml(t.nama) +
          ' - ' +
          t.jumlah_hadir +
          ' org ' +
          (t.checked_in
            ? '<span class="badge success">Checked-in</span>'
            : '<span class="badge">' + (t.status || 'Belum') + '</span>') +
          '</span>';
        if (!t.checked_in) {
          const btn = document.createElement('button');
          btn.className = 'btn-pink';
          btn.textContent = 'Check-in';
          btn.addEventListener('click', function () {
            manualCheckin(t, btn);
          });
          div.appendChild(btn);
        }
        results.appendChild(div);
      });
    }
  } catch (err) {
    console.error('Manual search error:', err);
  }
}, 500);

const manualSearchEl = document.getElementById('manual-search') as HTMLInputElement | null;
if (manualSearchEl) {
  manualSearchEl.addEventListener('input', doManualSearch);
}

interface ManualTamu {
  id: string;
  nama: string;
  jumlah_hadir: number;
}

async function manualCheckin(tamu: ManualTamu, btn: HTMLButtonElement): Promise<void> {
  if (!confirm('Check-in ' + tamu.nama + ' (' + tamu.jumlah_hadir + ' org)?')) return;
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  try {
    await state.dashboardSb
      .from('guest_checkins')
      .insert([{ rsvp_id: tamu.id, method: 'manual', guest_count_actual: tamu.jumlah_hadir }]);
    await state.dashboardSb.from('rsvps').update({ checked_in: true }).eq('id', tamu.id);
    showToast(escapeHtml(tamu.nama) + ' berhasil check-in!');
    const manualSearch = document.getElementById('manual-search') as HTMLInputElement | null;
    if (manualSearch) manualSearch.value = '';
    const manualResults = document.getElementById('manual-results');
    if (manualResults) manualResults.innerHTML = '';
    loadCheckinLog();
    loadTamuRSVP();
  } catch (err) {
    showToast('Gagal check-in.', true);
    btn.disabled = false;
    btn.textContent = 'Check-in';
  }
}

interface CheckinRow {
  rsvp_id: { nama: string } | null;
  checked_in_at: string;
  method: string;
  guest_count_actual: number;
}

export async function loadCheckinLog(): Promise<void> {
  const log = document.getElementById('checkin-log');
  const empty = document.getElementById('checkin-empty');
  if (!log || !empty) return;
  try {
    const res = await state.dashboardSb
      .from('guest_checkins')
      .select('rsvp_id(nama), checked_in_at, method, guest_count_actual')
      .order('checked_in_at', { ascending: false })
      .limit(20);
    if (res.error) throw res.error;
    const data = ((res.data || []) as unknown) as CheckinRow[];
    log.innerHTML = '';
    if (data.length === 0) {
      empty.classList.remove('d-none');
      return;
    }
    empty.classList.add('d-none');
    data.forEach(function (c: CheckinRow) {
      const div = document.createElement('div');
      div.className = 'checkin-item';
      div.innerHTML =
        '<strong>' +
        escapeHtml((c.rsvp_id && c.rsvp_id.nama) || '?') +
        '</strong> - ' +
        c.guest_count_actual +
        ' org - <span class="badge ' +
        (c.method === 'qr' ? 'pink' : '') +
        '">' +
        c.method +
        '</span> <span class="gb-admin-time">' +
        formatTime(c.checked_in_at) +
        '</span>';
      log.appendChild(div);
    });
  } catch (err) {
    console.error('Checkin log error:', err);
  }
}
