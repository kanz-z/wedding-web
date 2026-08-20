// src/dashboard/checkin.ts — Check-in page: QR scanner, manual, log, mode toggle
// Fase 5: integrasi html5-qrcode sungguhan + halaman reservasi post-scan

import { Html5Qrcode } from "html5-qrcode";
import {
  escapeHtml,
  formatTime,
  showToast,
  showErrorModal,
  show,
  hide,
  debounce,
} from "@/shared/ui";
import { showModal, hideModal, renderNotifications } from "./ui";
import { postCheckIn } from "./checkin-request";
import { guestList, fetchGuests } from "./state";
import { supabase } from "./supabase-client";
import type { GuestWithMeta } from "./state";
import type { Reservation } from "@/types/supabase";

// --- QR Scanner State ---
let html5QrCode: Html5Qrcode | null = null;
let currentCameraId: string | null = null;
let availableCameras: { id: string; label: string }[] = [];
let isScanning = false;
let isProcessing = false;

const elementId = "qr-reader";
const RESCAN_DELAY = 2000;
const CAMERA_SWITCH_DELAY = 2500;
const SCAN_FLASH_FADE = 1800;
const SCAN_FLASH_REMOVE = 400;

// --- Camera management ---
async function getCameras(): Promise<{ id: string; label: string }[]> {
  try {
    const devices = await Html5Qrcode.getCameras();
    return devices.map((d) => ({ id: d.id, label: d.label || "Kamera" }));
  } catch {
    return [];
  }
}

function findBackCamera(
  cameras: { id: string; label: string }[],
): string | null {
  const back = cameras.find(
    (c) =>
      c.label.toLowerCase().includes("back") ||
      c.label.toLowerCase().includes("belakang") ||
      c.label.toLowerCase().includes("environment"),
  );
  return back?.id ?? cameras[0]?.id ?? null;
}

function findFrontCamera(
  cameras: { id: string; label: string }[],
): string | null {
  const front = cameras.find(
    (c) =>
      c.label.toLowerCase().includes("front") ||
      c.label.toLowerCase().includes("depan") ||
      c.label.toLowerCase().includes("user"),
  );
  return front?.id ?? null;
}

// --- Scanner UI helpers ---
function setScannerStatus(text: string, isError?: boolean): void {
  const el = document.getElementById("scanner-status");
  if (!el) return;
  el.textContent = text;
  el.className = "scanner-instruction" + (isError ? " is-error" : "");
}

function showScannerView(): void {
  const frame = document.querySelector(".scanner-frame");
  const placeholder = frame?.querySelector<HTMLElement>(".scanner-placeholder");
  const qrDiv = document.getElementById(elementId);

  if (placeholder) hide(placeholder);
  if (qrDiv) show(qrDiv);

  if (!qrDiv && frame) {
    const div = document.createElement("div");
    div.id = elementId;
    div.style.width = "100%";
    div.style.aspectRatio = "1 / 1";
    frame.appendChild(div);
  }
}

function resetScannerView(): void {
  const frame = document.querySelector(".scanner-frame");
  const placeholder = frame?.querySelector<HTMLElement>(".scanner-placeholder");
  const qrDiv = document.getElementById(elementId);

  if (placeholder) show(placeholder);
  if (qrDiv) hide(qrDiv);

  const btn = document.getElementById(
    "btn-start-scan",
  ) as HTMLButtonElement | null;
  if (btn) show(btn);

  const stopBtn = document.getElementById(
    "btn-stop-scan",
  ) as HTMLButtonElement | null;
  if (stopBtn) hide(stopBtn);

  const switchBtn = document.getElementById(
    "btn-switch-camera",
  ) as HTMLButtonElement | null;
  if (switchBtn) hide(switchBtn);

  isScanning = false;
}

// --- QR Code scanning ---
async function startScanner(): Promise<void> {
  const cameras = await getCameras();
  if (cameras.length === 0) {
    showToast("Tidak ada kamera terdeteksi. Gunakan check-in manual.", true);
    return;
  }

  availableCameras = cameras;

  const backId = findBackCamera(cameras);
  currentCameraId = backId ?? cameras[0].id;

  if (!html5QrCode) {
    let qrDiv = document.getElementById(elementId);
    if (!qrDiv) {
      qrDiv = document.createElement("div");
      qrDiv.id = elementId;
      qrDiv.style.width = "100%";
      qrDiv.style.aspectRatio = "1 / 1";
      const frame = document.querySelector(".scanner-frame");
      frame?.appendChild(qrDiv);
    }
    html5QrCode = new Html5Qrcode(elementId);
  }

  try {
    showScannerView();

    // ⚠️ Set isScanning = true BEFORE start() — library's foreverScan
    // can fire onScanSuccess BEFORE start() resolves.
    isScanning = true;

    const frame = document.querySelector(
      ".scanner-frame",
    ) as HTMLElement | null;
    const frameWidth = frame ? frame.clientWidth : 360;
    const boxSize = Math.round(frameWidth * 0.7);

    await html5QrCode.start(
      { deviceId: { exact: currentCameraId } },
      {
        fps: 10,
        qrbox: { width: boxSize, height: boxSize },
        aspectRatio: 1,
      },
      onScanSuccess,
      undefined,
    );

    const btn = document.getElementById(
      "btn-start-scan",
    ) as HTMLButtonElement | null;
    if (btn) hide(btn);

    const stopBtn = document.getElementById(
      "btn-stop-scan",
    ) as HTMLButtonElement | null;
    if (stopBtn) show(stopBtn);

    const switchBtn = document.getElementById(
      "btn-switch-camera",
    ) as HTMLButtonElement | null;
    if (switchBtn && cameras.length >= 2) show(switchBtn);

    setScannerStatus("Arahkan kamera ke QR code tamu");
  } catch (err) {
    showToast("Gagal mengakses kamera. Periksa izin kamera.", true);
    resetScannerView();
  }
}

async function stopScanner(): Promise<void> {
  isProcessing = false;
  if (html5QrCode && isScanning) {
    try {
      await html5QrCode.stop();
    } catch (err) {
      showToast(
        `Error: ${err}. Gagal menghentikan kamera. Hubungi admin.`,
        true,
      );
    }
  }
  resetScannerView();
}

async function restartWithCamera(cameraId: string): Promise<void> {
  if (!html5QrCode) return;
  const frame = document.querySelector(".scanner-frame") as HTMLElement | null;
  const frameWidth = frame ? frame.clientWidth : 360;
  const boxSize = Math.round(frameWidth * 0.7);
  await html5QrCode.start(
    { deviceId: { exact: cameraId } },
    { fps: 10, qrbox: { width: boxSize, height: boxSize }, aspectRatio: 1 },
    onScanSuccess,
    undefined,
  );
}

async function switchCamera(): Promise<void> {
  // Gunakan availableCameras yang sudah di-cache oleh startScanner().
  // Jangan panggil getCameras() ulang saat stream aktif — di Android Chrome,
  // enumerateDevices() hanya me-return kamera yang sedang streaming.
  if (availableCameras.length === 0) {
    // Fallback: hanya jika startScanner() belum pernah mengisi cache
    try {
      availableCameras = await getCameras();
    } catch {
      showToast("Gagal mendeteksi kamera", true);
      return;
    }
  }

  if (availableCameras.length < 2) {
    showToast("Hanya tersedia 1 kamera", true);
    return;
  }

  if (!html5QrCode || !isScanning) {
    showToast("Scanner tidak aktif. Mulai scan terlebih dahulu", true);
    return;
  }

  const curIdx = availableCameras.findIndex((c) => c.id === currentCameraId);
  const prevCameraId = currentCameraId;
  const nextIdx = (curIdx + 1) % availableCameras.length;
  currentCameraId = availableCameras[nextIdx].id;

  if (!prevCameraId) {
    showToast("Tidak dapat menentukan kamera saat ini", true);
    return;
  }

  // Loading state: disable tombol + spinner
  const switchBtn = document.getElementById(
    "btn-switch-camera",
  ) as HTMLButtonElement | null;
  if (switchBtn) {
    switchBtn.disabled = true;
    switchBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-1"></span> Ganti...';
  }

  try {
    await html5QrCode.stop();
    await restartWithCamera(currentCameraId);
  } catch (_err) {
    // Fallback to previous camera if new one fails (e.g., virtual device)
    currentCameraId = prevCameraId;
    try {
      await html5QrCode.stop().catch(() => {});
      await restartWithCamera(prevCameraId);
      setScannerStatus(
        "Kamera tidak tersedia. Kembali ke kamera sebelumnya",
        true,
      );
      setTimeout(
        () => setScannerStatus("Arahkan kamera ke QR code tamu"),
        CAMERA_SWITCH_DELAY,
      );
    } catch (_err2) {
      isScanning = false;
      resetScannerView();
      showToast("Gagal mengganti kamera", true);
    }
  } finally {
    // Reset tombol state
    if (switchBtn) {
      switchBtn.disabled = false;
      switchBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Ganti Kamera';
    }
  }
}

// --- Handle scan result ---
async function onScanSuccess(decodedText: string): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  const qrToken = decodedText.trim();

  try {
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("qr_token", qrToken)
      .maybeSingle();

    if (error || !data) {
      addScanResult(
        "QR tidak dikenal",
        false,
        "QR code tidak terdaftar di database",
      );
      showToast("QR code tidak terdaftar di database", true);
      setScannerStatus("QR tidak terdaftar. Coba scan ulang", true);
      setTimeout(() => {
        setScannerStatus("Arahkan kamera ke QR code tamu");
        isProcessing = false;
      }, RESCAN_DELAY);
      return;
    }

    const reservation = data as Reservation;

    const { data: ciData } = await supabase
      .from("check_in_transactions")
      .select("delta")
      .eq("reservation_id", reservation.id);

    const checkedIn = (ciData || []).reduce(
      (sum, t) => sum + (t.delta as number),
      0,
    );

    if (checkedIn >= reservation.guest_count) {
      addScanResult(
        reservation.name,
        true,
        `Sudah check-in ${checkedIn}/${reservation.guest_count}`,
      );
      showToast(`${reservation.name} sudah check-in semua`, true);
      setScannerStatus("Tamu sudah check-in semua. Coba scan lain", true);
      setTimeout(() => {
        setScannerStatus("Arahkan kamera ke QR code tamu");
        isProcessing = false;
      }, RESCAN_DELAY);
      return;
    }

    showPostScanModal(reservation, checkedIn);
    // isProcessing stays true until modal close (handled by modal callbacks)
  } catch (err: unknown) {
    showToast(
      "Gagal: " + (err instanceof Error ? err.message : String(err)),
      true,
    );
    isProcessing = false;
  }
}

function showScanSuccessFlash(guestName: string, delta: number): void {
  const frame = document.querySelector(".scanner-frame") as HTMLElement | null;
  if (!frame) return;

  // remove existing flash
  const old = frame.querySelector(".scan-success-flash");
  if (old) old.remove();

  const flash = document.createElement("div");
  flash.className = "scan-success-flash";
  flash.innerHTML = `
    <div class="scan-success-flash__icon"><i class="bi bi-check-circle-fill"></i></div>
    <div class="scan-success-flash__name">${escapeHtml(guestName)}</div>
    <div class="scan-success-flash__detail">Check-in +${delta} berhasil</div>
  `;
  flash.style.cssText = `
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 8px;
    background: rgba(0,0,0,0.82); z-index: 10; border-radius: var(--radius);
    color: #fff; text-align: center; animation: scanFlashIn 0.25s ease;
  `;
  frame.appendChild(flash);

  setTimeout(() => {
    flash.style.opacity = "0";
    flash.style.transition = "opacity 0.4s ease";
    setTimeout(() => flash.remove(), SCAN_FLASH_REMOVE);
  }, SCAN_FLASH_FADE);
}

// --- Post-scan modal (5.2) ---
function showPostScanModal(reservation: Reservation, checkedIn: number): void {
  const nameEl = document.getElementById("postscan-guest-name");
  const detailEl = document.getElementById("postscan-guest-detail");
  const bodyEl = document.getElementById("postscan-guest-body");
  const countEl = document.getElementById("postscan-checked-in-count");

  if (nameEl) nameEl.textContent = reservation.name;

  const remaining = reservation.guest_count - checkedIn;
  const isComplete = checkedIn >= reservation.guest_count;

  // GAP-012: Auto check-in untuk kuota 1 — langsung check-in tanpa modal
  if (reservation.guest_count === 1 && checkedIn === 0 && !isComplete) {
    const overlay = document.getElementById("postscan-modal-overlay");
    if (overlay) {
      overlay.dataset.reservationId = reservation.id;
      overlay.dataset.guestCount = String(reservation.guest_count);
      overlay.dataset.checkedIn = String(checkedIn);
    }
    doPostscanCheckinAll(true);
    return;
  }

  if (detailEl) {
    detailEl.textContent = isComplete
      ? `Sudah check-in: ${checkedIn}/${reservation.guest_count}, semua sudah hadir`
      : `Sudah check-in: ${checkedIn}/${reservation.guest_count}, sisa ${remaining}`;
  }

  if (countEl) {
    countEl.innerHTML = `<span class="mono-time">${checkedIn}</span><span style="color:var(--ink-muted)">/${reservation.guest_count}</span>`;
  }

  let html = '<dl class="detail-grid">';
  html += `<dt>Kelompok</dt><dd>${escapeHtml(reservation.kelompok || "–")}</dd>`;
  html += `<dt>Kategori</dt><dd>${reservation.kategori === "keluarga" ? "Keluarga" : "Bukan Keluarga"}</dd>`;
  html += `<dt>No. WhatsApp</dt><dd>${escapeHtml(reservation.nomor_wa || "–")}</dd>`;
  html += `<dt>RSVP</dt><dd>${reservation.rsvp === "hadir" ? "Hadir" : reservation.rsvp === "tidak" ? "Tidak Hadir" : "Belum Respon"}</dd>`;
  if (reservation.notes)
    html += `<dt>Catatan</dt><dd>${escapeHtml(reservation.notes)}</dd>`;
  html += "</dl>";

  if (bodyEl) bodyEl.innerHTML = html;

  const allBtn = document.getElementById(
    "postscan-btn-all",
  ) as HTMLButtonElement | null;
  const partialBtn = document.getElementById(
    "postscan-btn-partial",
  ) as HTMLButtonElement | null;
  const partialInput = document.getElementById(
    "postscan-partial-input",
  ) as HTMLInputElement | null;
  const allLabel = document.getElementById("postscan-all-label");

  if (allBtn) allBtn.disabled = isComplete;
  if (allLabel)
    allLabel.textContent = isComplete
      ? "Semua sudah check-in"
      : `Masuk Semua (+${Math.max(1, remaining)})`;
  if (partialBtn) partialBtn.disabled = isComplete || remaining <= 0;
  if (partialInput) {
    partialInput.value = String(Math.max(1, remaining));
    partialInput.max = String(Math.max(1, remaining));
  }

  const overlay = document.getElementById("postscan-modal-overlay");
  if (overlay) {
    overlay.dataset.reservationId = reservation.id;
    overlay.dataset.guestCount = String(reservation.guest_count);
    overlay.dataset.checkedIn = String(checkedIn);
  }

  showModal("postscan-modal-overlay");
}

// --- Post-scan actions ---

/**
 * Satu jalur pemanggilan edge function check-in (memunculkan 3 duplikat).
 * Return: { ok } — UI error diputuskan di sini:
 *  - 401/unauthorized (sesi mati) → modal fatal
 *  - 409/quota (bukan sesi)      → toast (tetap ada opsi override)
 *  - selainnya                   → modal error (aksi check-in gagal total)
 */
interface CheckinCallResult {
  ok: boolean;
  guestName?: string;
}

async function doCheckinCall(
  resId: string,
  delta: number,
  opts: { isOverride?: boolean; notes?: string } = {},
): Promise<CheckinCallResult> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      showErrorModal({
        message:
          "Sesi telah berakhir. Silakan login kembali untuk melanjutkan.",
        buttons: [{ text: "Masuk", className: "btn btn-primary" }],
      });
      return { ok: false };
    }

    const { status, result } = await postCheckIn(
      {
        reservation_id: resId,
        delta,
        method: "qr",
        is_override: opts.isOverride,
        notes: opts.notes,
      },
      token,
    );

    if (status === 0) {
      showToast("Server tidak merespon, coba lagi nanti", true);
      return { ok: false };
    }
    if (status >= 400) {
      const msg =
        status === 401
          ? "Sesi tidak valid. Silakan login kembali"
          : status === 409
            ? "Kuota melebihi jumlah tamu. Gunakan override"
            : (result.error as string) || "Gagal check-in";
      showToast(msg, true);
      return { ok: false };
    }

    const guestName =
      ((result as Record<string, unknown>).guest_name as string) || "Tamu";
    return { ok: true, guestName };
  } catch (err: unknown) {
    showErrorModal({
      message:
        "Gagal memproses check-in: " +
        (err instanceof Error ? err.message : String(err)),
      buttons: [{ text: "Tutup", className: "btn btn-primary" }],
    });
    throw err;
  }
}

async function doPostscanCheckinAll(isAutoCheckin = false): Promise<void> {
  const overlay = document.getElementById("postscan-modal-overlay");
  const resId = overlay?.dataset.reservationId;
  if (!resId) {
    isProcessing = false;
    return;
  }

  const guestCount = parseInt(overlay?.dataset.guestCount ?? "0", 10);
  const checkedIn = parseInt(overlay?.dataset.checkedIn ?? "0", 10);
  const delta = guestCount - checkedIn;

  const { ok, guestName } = await doCheckinCall(resId, delta);
  if (!ok) {
    isProcessing = false;
    return;
  }

  addScanResult(guestName!, true, `Check-in +${delta} berhasil`);
  showScanSuccessFlash(guestName!, delta);

  await fetchGuests();
  renderNotifications();
  window.dispatchEvent(new CustomEvent("checkin-updated"));

  if (isAutoCheckin) {
    // Modal tidak pernah dibuka untuk kuota 1 — tidak perlu refresh modal,
    // tapi WAJIB lepas isProcessing supaya scanner tidak macet.
    setTimeout(() => {
      setScannerStatus("Arahkan kamera ke QR code tamu");
      isProcessing = false;
    }, RESCAN_DELAY);
    return;
  }

  await refreshPostScanModal(resId);
}

async function doPostscanCheckinPartial(): Promise<void> {
  const overlay = document.getElementById("postscan-modal-overlay");
  const resId = overlay?.dataset.reservationId;
  if (!resId) return;

  const guestCount = parseInt(overlay?.dataset.guestCount ?? "0", 10);
  const checkedIn = parseInt(overlay?.dataset.checkedIn ?? "0", 10);
  const remaining = guestCount - checkedIn;

  const input = document.getElementById(
    "postscan-partial-input",
  ) as HTMLInputElement | null;
  const delta = parseInt(input?.value ?? "0", 10);
  if (!delta || delta < 1) {
    showToast("Jumlah tidak valid", true);
    isProcessing = false;
    return;
  }

  // Jika delta melebihi remaining, arahkan ke override modal
  if (delta > remaining) {
    const warnEl = document.getElementById("override-warning");
    const notesEl = document.getElementById(
      "override-notes",
    ) as HTMLTextAreaElement | null;
    const inputEl = document.getElementById(
      "override-delta",
    ) as HTMLInputElement | null;
    const overrideOverlay = document.getElementById("override-modal-overlay");

    if (warnEl)
      warnEl.textContent = `Check-in sebanyak ${delta} melebihi kuota tersisa (${remaining}/${guestCount}). Masukkan jumlah tambahan dan alasan override.`;
    if (notesEl) notesEl.value = "";
    if (inputEl) {
      inputEl.value = String(delta);
      inputEl.min = "1";
    }
    if (overrideOverlay) overrideOverlay.dataset.reservationId = resId;

    // ponytail: isProcessing stays true until override completes or user cancels
    showModal("override-modal-overlay");
    return;
  }

  try {
    const { ok, guestName } = await doCheckinCall(resId, delta);
    if (!ok) {
      isProcessing = false;
      return;
    }

    addScanResult(guestName!, true, `Check-in +${delta} berhasil`);
    showScanSuccessFlash(guestName!, delta);

    await fetchGuests();
    renderNotifications();
    window.dispatchEvent(new CustomEvent("checkin-updated"));

    // Refresh post-scan modal dengan data terbaru
    await refreshPostScanModal(resId);
  } catch (err: unknown) {
    isProcessing = false;
  }
}

async function doPostscanOverride(): Promise<void> {
  const overlay = document.getElementById("postscan-modal-overlay");
  const resId = overlay?.dataset.reservationId;
  if (!resId) return;

  const guestCount = parseInt(overlay?.dataset.guestCount ?? "0", 10);
  const checkedIn = parseInt(overlay?.dataset.checkedIn ?? "0", 10);

  const overrideOverlay = document.getElementById("override-modal-overlay");
  const warnEl = document.getElementById("override-warning");
  const notesEl = document.getElementById(
    "override-notes",
  ) as HTMLTextAreaElement | null;
  const inputEl = document.getElementById(
    "override-delta",
  ) as HTMLInputElement | null;

  if (warnEl)
    warnEl.textContent = `Check-in melebihi kuota (${checkedIn}/${guestCount}). Masukkan jumlah tambahan dan alasan override.`;
  if (notesEl) notesEl.value = "";
  if (inputEl) {
    inputEl.value = "1";
    inputEl.min = "1";
  }
  if (overrideOverlay) overrideOverlay.dataset.reservationId = resId;

  showModal("override-modal-overlay");
}

async function doPostscanOverrideConfirm(): Promise<void> {
  const overrideOverlay = document.getElementById("override-modal-overlay");
  const resId = overrideOverlay?.dataset.reservationId;
  const source = overrideOverlay?.dataset.source;
  if (!resId) {
    isProcessing = false;
    return;
  }

  const delta = parseInt(
    (document.getElementById("override-delta") as HTMLInputElement)?.value ??
      "0",
    10,
  );
  const notes = (
    document.getElementById("override-notes") as HTMLTextAreaElement
  )?.value.trim();

  if (!delta || delta < 1) {
    showToast("Jumlah tidak valid", true);
    isProcessing = false;
    return;
  }
  if (!notes) {
    showToast("Alasan override wajib diisi", true);
    isProcessing = false;
    return;
  }

  const { ok, guestName } = await doCheckinCall(resId, delta, {
    isOverride: true,
    notes,
  });
  if (!ok) {
    isProcessing = false;
    return;
  }

  // Tutup HANYA override modal
  hideModal("override-modal-overlay");

  addScanResult(guestName!, true, `Override +${delta} berhasil`);
  showScanSuccessFlash(guestName!, delta);

  await fetchGuests();
  renderNotifications();
  window.dispatchEvent(new CustomEvent("checkin-updated"));

  // Jika override berasal dari checkin dialog, refresh dialog manual
  if (source === "checkin-dialog") {
    window.dispatchEvent(
      new CustomEvent("open-checkin-dialog", { detail: { id: resId } }),
    );
    return;
  }

  // Default: refresh post-scan modal
  await refreshPostScanModal(resId);
}

// --- Refresh post-scan modal setelah check-in/override ---
async function refreshPostScanModal(reservationId: string): Promise<void> {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle();

  if (error || !data) {
    hideModal("postscan-modal-overlay");
    isProcessing = false;
    return;
  }

  const reservation = data as Reservation;

  const { data: ciData } = await supabase
    .from("check_in_transactions")
    .select("delta")
    .eq("reservation_id", reservation.id);

  const checkedIn = (ciData || []).reduce(
    (sum, t) => sum + (t.delta as number),
    0,
  );

  // Update overlay dataset
  const overlay = document.getElementById("postscan-modal-overlay");
  if (overlay) {
    overlay.dataset.checkedIn = String(checkedIn);
    overlay.dataset.guestCount = String(reservation.guest_count);
  }

  // Update counter display
  const countEl = document.getElementById("postscan-checked-in-count");
  if (countEl) {
    countEl.innerHTML = `<span class="mono-time">${checkedIn}</span><span style="color:var(--ink-muted)">/${reservation.guest_count}</span>`;
  }

  // Update detail text
  const detailEl = document.getElementById("postscan-guest-detail");
  const remaining = reservation.guest_count - checkedIn;
  const isComplete = checkedIn >= reservation.guest_count;
  if (detailEl) {
    detailEl.textContent = isComplete
      ? `Sudah check-in: ${checkedIn}/${reservation.guest_count}, semua sudah hadir`
      : `Sudah check-in: ${checkedIn}/${reservation.guest_count}, sisa ${remaining}`;
  }

  // Update button states
  const allBtn = document.getElementById(
    "postscan-btn-all",
  ) as HTMLButtonElement | null;
  const partialBtn = document.getElementById(
    "postscan-btn-partial",
  ) as HTMLButtonElement | null;
  const partialInput = document.getElementById(
    "postscan-partial-input",
  ) as HTMLInputElement | null;
  const allLabel = document.getElementById("postscan-all-label");

  if (allBtn) allBtn.disabled = isComplete;
  if (allLabel)
    allLabel.textContent = isComplete
      ? "Semua sudah check-in"
      : `Masuk Semua (+${Math.max(1, remaining)})`;
  if (partialBtn) partialBtn.disabled = isComplete || remaining <= 0;
  if (partialInput) {
    partialInput.value = String(Math.max(1, remaining));
    partialInput.max = String(Math.max(1, remaining));
  }
}

// --- Scan results panel (5.9) ---
interface ScanEntry {
  name: string;
  valid: boolean;
  message: string;
  time: string;
}

let scanHistory: ScanEntry[] = [];

export function addScanResult(
  name: string,
  valid: boolean,
  message?: string,
): void {
  const entry: ScanEntry = {
    name,
    valid,
    message: message || (valid ? "Check-in berhasil" : "QR tidak valid"),
    time: new Date().toISOString(),
  };
  scanHistory.unshift(entry);
  if (scanHistory.length > 3) scanHistory = scanHistory.slice(0, 3);
  renderScanResults();
}

function renderScanResults(): void {
  const list = document.getElementById("scan-results-list");
  if (!list) return;

  if (scanHistory.length === 0) {
    list.innerHTML =
      '<p style="color:var(--ink-muted);font-size:0.8125rem">Belum ada aktivitas scan pada sesi ini.</p>';
    return;
  }

  list.innerHTML = scanHistory
    .map(
      (entry) =>
        `<div class="scan-result-item${entry.valid ? "" : " is-invalid"}">
          <div class="scan-result-item__icon"><i class="bi bi-${entry.valid ? "check-lg" : "x-lg"}"></i></div>
          <div>
            <div class="scan-result-item__name">${escapeHtml(entry.name)}</div>
            <div class="scan-result-item__meta">${escapeHtml(entry.message)} · ${formatTime(entry.time)}</div>
          </div>
        </div>`,
    )
    .join("");
}

// --- Check-in log (admin mode) ---
export function renderCheckinLog(): void {
  const checked = guestList
    .filter((g) => g.checkedInAt)
    .sort(
      (a, b) =>
        new Date(b.checkedInAt ?? 0).getTime() -
        new Date(a.checkedInAt ?? 0).getTime(),
    );
  const el = document.getElementById("checkin-log-list");
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
        .join("")
    : '<p style="color:var(--ink-muted);font-size:.8125rem;">Belum ada riwayat check-in.</p>';
}

// --- Init check-in events ---
export function initCheckinEvents(): void {
  // Mode toggle (5.8)
  document.querySelectorAll(".mode-toggle button").forEach((btn) =>
    btn.addEventListener("click", function (this: HTMLButtonElement) {
      document
        .querySelectorAll(".mode-toggle button")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      if (this.dataset.mode === "scan") {
        show(document.getElementById("checkin-mode-scan"));
        hide(document.getElementById("checkin-mode-admin"));
      } else {
        hide(document.getElementById("checkin-mode-scan"));
        show(document.getElementById("checkin-mode-admin"));
        renderCheckinLog();
        stopScanner();
      }
    }),
  );

  // Start/stop scan
  document
    .getElementById("btn-start-scan")
    ?.addEventListener("click", () => startScanner());

  // Stop scan
  document
    .getElementById("btn-stop-scan")
    ?.addEventListener("click", () => stopScanner());

  // Switch camera
  document
    .getElementById("btn-switch-camera")
    ?.addEventListener("click", () => switchCamera());

  // Post-scan modal close
  document
    .getElementById("postscan-modal-overlay")
    ?.addEventListener("click", (e) => {
      if (
        (e.target as HTMLElement).dataset.modalClose !== undefined ||
        (e.target as HTMLElement).id === "postscan-modal-overlay"
      ) {
        hideModal("postscan-modal-overlay");
        isProcessing = false;
      }
    });

  // Post-scan buttons
  document
    .getElementById("postscan-btn-all")
    ?.addEventListener("click", () => doPostscanCheckinAll());
  document
    .getElementById("postscan-btn-partial")
    ?.addEventListener("click", doPostscanCheckinPartial);
  document
    .getElementById("postscan-btn-override")
    ?.addEventListener("click", doPostscanOverride);
  document
    .getElementById("postscan-btn-close")
    ?.addEventListener("click", () => {
      hideModal("postscan-modal-overlay");
      isProcessing = false;
    });

  // Override modal
  document
    .getElementById("override-modal-overlay")
    ?.addEventListener("click", (e) => {
      if (
        (e.target as HTMLElement).dataset.modalClose !== undefined ||
        (e.target as HTMLElement).id === "override-modal-overlay"
      ) {
        hideModal("override-modal-overlay");
        isProcessing = false;
      }
    });
  document
    .getElementById("override-confirm-btn")
    ?.addEventListener("click", doPostscanOverrideConfirm);
  document
    .getElementById("override-cancel-btn")
    ?.addEventListener("click", () => {
      hideModal("override-modal-overlay");
    });

  // Manual check-in (5.7)
  document
    .getElementById("btn-toggle-manual")
    ?.addEventListener("click", () =>
      document
        .getElementById("manual-search-panel")
        ?.classList.toggle("d-none-important"),
    );

  const mi = document.getElementById(
    "manual-checkin-search",
  ) as HTMLInputElement | null;

  const debouncedManualSearch = debounce((q: string) => {
    const r = document.getElementById("manual-checkin-results");
    if (!r) return;
    if (!q) {
      r.innerHTML = "";
      return;
    }
    const matches = guestList
      .filter(
        (g) =>
          (g.name.toLowerCase().includes(q) || (g.nomor_wa ?? "").includes(q)),
      )
      .slice(0, 3);
    r.innerHTML = matches.length
      ? matches
          .map(
            (g) =>
              `<div class="manual-result-item">
                <span>${escapeHtml(g.name)} ${g.kelompok ? `<span style="color:var(--ink-muted);font-size:0.75rem">(${escapeHtml(g.kelompok)})</span>` : ""}</span>
                <button type="button" data-manual-checkin="${g.id}">Check-in</button>
              </div>`,
          )
          .join("")
      : '<p style="color:var(--ink-muted);font-size:.8125rem;">Tidak ditemukan tamu yang cocok.</p>';
  }, 250);

  mi?.addEventListener("input", function () {
    const q = this.value.trim().toLowerCase();
    debouncedManualSearch(q);
  });

  document
    .getElementById("manual-checkin-results")
    ?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-manual-checkin]",
      );
      if (!btn) return;
      const id = btn.dataset.manualCheckin!;
      if (mi) mi.value = "";
      const r = document.getElementById("manual-checkin-results");
      if (r) r.innerHTML = "";
      // Dispatch to open check-in dialog (handled by guests.ts)
      window.dispatchEvent(
        new CustomEvent("open-checkin-dialog", { detail: { id } }),
      );
    });

  // Page change — stop scanner
  window.addEventListener("page-changed", ((e: CustomEvent) => {
    if (e.detail.page !== "checkin" && isScanning) stopScanner();
    if (e.detail.page === "checkin") renderCheckinLog();
  }) as EventListener);

  window.addEventListener("checkin-updated", () => {
    renderCheckinLog();
    renderScanResults();
  });

  renderScanResults();
}
