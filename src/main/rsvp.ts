// src/main/rsvp.ts
import { urlParams, nama, pronoun, guestId, guestToken } from './url-params';
import { supabaseClient } from './supabase-client';
import { config } from '../config';
import { showToast, showRsvpModal, hideRsvpModal } from './utils';

// html2canvas and qrcodejs have no type definitions; treat as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html2canvasMod: any = html2canvas;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QRCodeMod: any = QRCode;

import html2canvas from 'html2canvas';
import QRCode from 'qrcodejs';

interface RsvpSubmitResult {
  is_approved: boolean;
  qr_token: string;
  jumlah_hadir: number;
  pesan: string | null;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

async function submitRSVP(
  guestId: string | null,
  namaInput: string,
  jumlahInput: number,
  statusInput: string,
  pesanInput: string,
  noWaInput: string,
  guestToken: string | null,
): Promise<RsvpSubmitResult> {
  const qrToken = generateUUID();
  const res = await fetch(config.RSVP_EDGE_FUNCTION, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + config.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      guest_id: guestId || null,
      nama: namaInput,
      nomor_wa: noWaInput,
      jumlah_hadir: jumlahInput,
      status: statusInput,
      pesan: pesanInput || null,
      qr_token: guestToken || qrToken,
    }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(function () {
      return {};
    });
    throw new Error(errData.error || 'Gagal mengirim RSVP. Silakan coba lagi.');
  }
  const data = (await res.json()) as { data: RsvpSubmitResult };
  return {
    is_approved: data.data.is_approved,
    qr_token: data.data.qr_token,
    jumlah_hadir: data.data.jumlah_hadir,
    pesan: data.data.pesan,
  };
}

async function renderDigitalCard(
  rsvpResult: RsvpSubmitResult,
  nama: string,
  jumlah: number,
  status: string,
): Promise<void> {
  const card = document.getElementById('digital-card')!;
  const qrDiv = document.getElementById('card-qr')!;
  card.querySelector('.card-nama')!.textContent = nama;
  card.querySelector('.card-status')!.textContent = status;
  card.querySelector('.card-kuota')!.textContent =
    'Berlaku untuk ' + jumlah + ' orang';
  qrDiv.innerHTML = '';
  new QRCodeMod(qrDiv, {
    text: rsvpResult.qr_token,
    width: 120,
    height: 120,
    colorDark: '#0a0a0a',
    colorLight: '#ffffff',
  });
  card.classList.add('is-visible');
  try {
    const canvas = await Promise.race([
      html2canvasMod(card, { scale: 2, useCORS: true }),
      new Promise<never>(function (_, reject) {
        setTimeout(function () {
          reject(new Error('Timeout render kartu'));
        }, 10000);
      }),
    ]);
    const blob = await new Promise<Blob>(function (resolve, reject) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (canvas as any).toBlob(function (b: Blob | null) {
        if (b) resolve(b);
        else reject(new Error('toBlob returned null'));
      }, 'image/png');
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Undangan_' + nama.replace(/\s+/g, '_') + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    card.classList.remove('is-visible');
    showToast(
      'Kartu undangan berhasil diunduh. Simpan untuk ditunjukkan saat hari acara!',
    );
  } catch (e) {
    console.error('Download gagal:', e);
    card.classList.add('is-visible');
    showToast(
      'Download gagal. Silakan screenshot kartu undangan di bawah ini.',
      true,
    );
  }
}

function renderAlreadySubmittedNote(nama: string, status: string): void {
  const note = document.getElementById('rsvp-already-note');
  const noteText = document.getElementById('rsvp-already-note-text');
  if (!note || !noteText) return;
  const keterangan =
    status === 'Tidak Hadir' ? 'tidak dapat hadir' : 'akan hadir';
  noteText.textContent =
    (nama ? nama + ', ' : '') +
    'Anda sudah konfirmasi ' +
    keterangan +
    '. Terima kasih!';
  note.classList.remove('d-none');
}

function applyAlreadySubmittedState(): void {
  let raw: string | null;
  try {
    raw = localStorage.getItem(getRsvpStorageKey());
  } catch (e) {
    return;
  }
  if (!raw) return;
  let record: { nama: string; status: string; ts: number };
  try {
    record = JSON.parse(raw);
  } catch (e) {
    return;
  }
  renderAlreadySubmittedNote(record.nama, record.status);
  const form = document.getElementById('my-form');
  if (!form) return;
  form
    .querySelectorAll('input, select, textarea, button')
    .forEach(function (el) {
      (el as HTMLInputElement | HTMLButtonElement).disabled = true;
    });
  const submitBtn = form.querySelector('button[type=submit]');
  if (submitBtn) submitBtn.textContent = 'Terkirim';
}

function getRsvpStorageKey(): string {
  return 'rsvp_submitted_' + (nama || 'anon').toLowerCase();
}

function saveRsvpSubmitted(nama: string, status: string): void {
  try {
    localStorage.setItem(
      getRsvpStorageKey(),
      JSON.stringify({ nama: nama, status: status, ts: Date.now() }),
    );
  } catch (e) { /* ignore storage errors */ }
  renderAlreadySubmittedNote(nama, status);
}

async function fetchGuest(guestSlug: string): Promise<unknown> {
  const res = await supabaseClient.rpc('get_guest_by_slug', {
    guest_slug: guestSlug,
  });
  if (res.error) throw res.error;
  return res.data;
}

export function initRsvp(): void {
  applyAlreadySubmittedState();
  const form = document.getElementById('my-form');
  if (!form) return;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type=submit]');
  const originalBtnText = submitBtn ? submitBtn.textContent : '';

  form.addEventListener('submit', async function (e: Event) {
    e.preventDefault();
    const namaInput =
      (document.getElementById('nama') as HTMLInputElement | null)?.value.trim() ?? '';
    const jumlahInput =
      parseInt((document.getElementById('jumlah') as HTMLInputElement | null)?.value ?? '') || 1;
    const statusInput =
      (document.getElementById('status') as HTMLSelectElement | null)?.value ?? '';
    const noWaInput =
      (document.getElementById('noWA') as HTMLInputElement | null)?.value.trim() ?? '';
    const pesanInput =
      (document.getElementById('pesan') as HTMLTextAreaElement | null)?.value.trim() ?? '';
    if (!namaInput || !statusInput || !noWaInput) {
      showToast('Lengkapi nama, konfirmasi, dan nomor WA.');
      return;
    }
    if (!submitBtn) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Mengirim...';
    let success = false;
    try {
      let gId = guestId;
      if (!gId) {
        const slug = nama;
        if (slug) {
          const guest = (await fetchGuest(slug)) as Array<{ id: string }> | null;
          if (guest && guest.length > 0) gId = guest[0].id;
        }
      }
      const tkn = guestToken;
      const result = await submitRSVP(
        gId,
        namaInput,
        jumlahInput,
        statusInput,
        pesanInput,
        noWaInput,
        tkn,
      );
      if (statusInput === 'Tidak Hadir') {
        showRsvpModal('Konfirmasi kehadiran berhasil dikirim. Terima kasih!');
        saveRsvpSubmitted(namaInput, statusInput);
        success = true;
        form
          .querySelectorAll('input, select, textarea, button')
          .forEach(function (el) {
            (el as HTMLInputElement | HTMLButtonElement).disabled = true;
          });
        submitBtn.textContent = 'Terkirim';
        return;
      }
      if (jumlahInput <= 2 && result.is_approved) {
        await renderDigitalCard(result, namaInput, jumlahInput, statusInput);
        saveRsvpSubmitted(namaInput, statusInput);
      } else if (jumlahInput > 2) {
        showRsvpModal(
          'Permintaan Anda sedang ditinjau panitia. Kartu undangan akan dikirim setelah disetujui.',
        );
        saveRsvpSubmitted(namaInput, statusInput);
      } else {
        showRsvpModal('Konfirmasi kehadiran berhasil dikirim. Terima kasih!');
        saveRsvpSubmitted(namaInput, statusInput);
      }
      success = true;
      form
        .querySelectorAll('input, select, textarea, button')
        .forEach(function (el) {
          (el as HTMLInputElement | HTMLButtonElement).disabled = true;
        });
      submitBtn.textContent = 'Terkirim';
    } catch (error) {
      console.error('Gagal mengirim:', error);
      showRsvpModal(
        (error instanceof Error ? error.message : '') ||
          'Maaf, terjadi kesalahan. Silakan coba lagi.',
        true,
      );
    } finally {
      submitBtn.disabled = success;
      if (!success) submitBtn.textContent = originalBtnText;
    }
  });
}
