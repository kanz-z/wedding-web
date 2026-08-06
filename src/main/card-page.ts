// src/main/card-page.ts
// Halaman kartu undangan untuk route /[slug]/card.
// Render setelah tamu mengisi RSVP — menampilkan kartu undangan digital
// dengan data tamu, QR code, dan info acara.

import { getGuestData, getGuestName } from "./slug-router";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { showToast } from "@/shared/ui";

interface CardData {
  nama: string;
  qrToken: string;
  tanggal: string;
  lokasi: string;
  dressCode: string;
}

interface GuestData {
  token?: string;
  slug?: string;
  [key: string]: unknown;
}

/** Tampilkan halaman kartu undangan setelah RSVP sukses */
export function renderCardPage(container: HTMLElement): void {
  const guest = getGuestData() as GuestData | null;
  if (!guest) {
    container.innerHTML = buildErrorHTML();
    return;
  }

  const data: CardData = {
    nama: getGuestName(),
    qrToken: guest.token ?? "",
    tanggal: "Sabtu, 22 Agustus 2026",
    lokasi: "RIVEA Riverside Cafe and Space, Ngaglik, Sleman, DIY",
    dressCode: "Formal / semi-formal",
  };

  container.innerHTML = buildCardHTML(data, guest.slug ?? "");
  bindEvents();
  generateQR(data.qrToken, data.nama);
}

/* ------------------------------------------------------------------ */
/*  HTML Builders                                                     */
/* ------------------------------------------------------------------ */

function buildCardHTML(data: CardData, slug: string): string {
  return `
    <div class="card-page">
      <header class="card-toolbar">
        <div class="card-toolbar__start">
          <a href="/${escapeAttr(slug)}" class="card-btn-back">
            <span class="card-btn-back__arrow" aria-hidden="true">&#8592;</span>
            <span>Kembali</span>
          </a>
        </div>
        <div class="card-toolbar__center">
          <div class="card-orientation-toggle" role="radiogroup" aria-label="Pilih orientasi kartu">
            <input type="radio" class="btn-check" name="cardOrientation" id="cardOrientationLandscape" autocomplete="off" checked aria-checked="true">
            <label class="btn" for="cardOrientationLandscape">Landscape</label>
            <input type="radio" class="btn-check" name="cardOrientation" id="cardOrientationPortrait" autocomplete="off" aria-checked="false">
            <label class="btn" for="cardOrientationPortrait">Portrait</label>
          </div>
        </div>
        <div class="card-toolbar__end" aria-hidden="true"></div>
      </header>

      <div class="card-stage">
        <section class="invitation-card landscape" id="invitationCard" aria-label="Kartu undangan pernikahan Reza dan Ashila">
          <div class="card-header-section">
            <p class="card-label">Kartu Undangan Pernikahan</p>
            <h1 class="card-couple-name">Reza &amp; Ashila</h1>
          </div>
          <img src="/assets/img/ornamen.svg" alt="ornament" class="ornament ornament-top">
          <img src="/assets/img/ornamen.svg" alt="ornament" class="ornament ornament-bottom">
          <div class="card-body-row">
            <div class="card-body-info">
              <div class="card-guest-highlight">
                <p class="card-info-label">Kepada Yth.</p>
                <p class="card-info-value card-info-value--guest-name">${escapeHtml(data.nama)}</p>
              </div>
              <dl class="card-info-list">
                <div class="card-info-row">
                  <dt class="card-info-label">Tanggal</dt>
                  <dd class="card-info-value">${escapeHtml(data.tanggal)}</dd>
                </div>
                <div class="card-info-row">
                  <dt class="card-info-label">Lokasi</dt>
                  <dd class="card-info-value">${escapeHtml(data.lokasi)}</dd>
                </div>
                <div class="card-info-row">
                  <dt class="card-info-label">Dress code</dt>
                  <dd class="card-info-value">${escapeHtml(data.dressCode)}</dd>
                </div>
              </dl>
            </div>
            <div class="card-body-qr">
              <div class="card-qr card-qr--loading" id="card-qr" role="img" aria-label="Memuat kode QR untuk ${escapeAttr(data.nama)}"></div>
            </div>
          </div>
          <div class="card-footer-section">
            <p class="card-instruction">Simpan kartu ini dan tunjukkan saat hari acara</p>
          </div>
        </section>

        <div class="card-actions">
          <button type="button" class="btn-download-card" id="btn-download-card">
            <span class="btn-download-card__text">Unduh Kartu</span>
          </button>
        </div>
      </div>

    </div>
  `;
}

function buildErrorHTML(): string {
  return `
    <div class="card-page">
      <div class="card-error">
        <div class="card-error__icon" aria-hidden="true">📋</div>
        <h1 class="card-error__title">Data Tamu Tidak Ditemukan</h1>
        <p class="card-error__message">
          Sepertinya sesi Anda telah berakhir atau data tamu belum tersedia. 
          Silakan kembali ke halaman utama untuk mengisi RSVP kembali.
        </p>
        <a href="/" class="card-btn-back" style="margin-top: 1rem;">
          <span class="card-btn-back__arrow" aria-hidden="true">&#8592;</span>
          <span>Kembali ke Beranda</span>
        </a>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  QR Code                                                           */
/* ------------------------------------------------------------------ */

function generateQR(token: string, guestName: string): void {
  const container = document.getElementById("card-qr");
  if (!container || !token) {
    if (container) {
      container.classList.remove("card-qr--loading");
      container.setAttribute("aria-label", "Kode QR tidak tersedia");
      container.innerHTML =
        '<span style="color: var(--card-ink-500); font-size: 0.8rem;">QR tidak tersedia</span>';
    }
    return;
  }

  const canvas = document.createElement("canvas");

  QRCode.toCanvas(
    canvas,
    token,
    {
      width: 300,
      margin: 2,
      color: { dark: "#0a0a0a", light: "#ffffff" },
      errorCorrectionLevel: "H",
    },
    (err: Error | null | undefined) => {
      container.classList.remove("card-qr--loading");

      if (err) {
        console.error("Gagal membuat QR code:", err);
        container.setAttribute("aria-label", "Gagal memuat kode QR");
        container.innerHTML =
          '<span style="color: var(--card-ink-500); font-size: 0.8rem;">Gagal memuat QR</span>';
        showToast("Gagal memuat kode QR. Silakan refresh halaman.", true);
        return;
      }

      container.appendChild(canvas);
      container.setAttribute(
        "aria-label",
        `Kode QR undangan untuk ${guestName}`,
      );
    },
  );
}

/* ------------------------------------------------------------------ */
/*  Events                                                            */
/* ------------------------------------------------------------------ */

function bindEvents(): void {
  const card = document.getElementById("invitationCard");
  const landscapeInput = document.getElementById(
    "cardOrientationLandscape",
  ) as HTMLInputElement | null;
  const portraitInput = document.getElementById(
    "cardOrientationPortrait",
  ) as HTMLInputElement | null;

  landscapeInput?.addEventListener("change", () => {
    if (landscapeInput.checked && card) {
      card.classList.remove("portrait");
      card.classList.add("landscape");
      landscapeInput.setAttribute("aria-checked", "true");
      portraitInput?.setAttribute("aria-checked", "false");
      triggerQRBounce(card);
    }
  });

  portraitInput?.addEventListener("change", () => {
    if (portraitInput.checked && card) {
      card.classList.remove("landscape");
      card.classList.add("portrait");
      portraitInput.setAttribute("aria-checked", "true");
      landscapeInput?.setAttribute("aria-checked", "false");
      triggerQRBounce(card);
    }
  });

  document
    .getElementById("btn-download-card")
    ?.addEventListener("click", handleDownload);
}

/* ------------------------------------------------------------------ */
/*  QR Bounce Animation                                               */
/* ------------------------------------------------------------------ */

function triggerQRBounce(card: HTMLElement): void {
  card.classList.add("qr-bounce");
  card.addEventListener(
    "animationend",
    () => card.classList.remove("qr-bounce"),
    { once: true },
  );
}

/* ------------------------------------------------------------------ */
/*  Download                                                          */
/* ------------------------------------------------------------------ */

function handleDownload(): void {
  const btn = document.getElementById(
    "btn-download-card",
  ) as HTMLButtonElement | null;
  const btnText = btn?.querySelector(".btn-download-card__text");
  const card = document.querySelector(".invitation-card") as HTMLElement | null;
  const guest = getGuestData() as GuestData | null;
  if (!card) return;
  card.classList.add("exporting");

  if (!btn) return;

  // Set loading state
  btn.disabled = true;
  if (btnText) {
    btnText.innerHTML =
      '<span class="btn-download-card__spinner"></span> Memproses...';
  }

  const scale = window.devicePixelRatio > 1 ? 2 : 1;

  html2canvas(card, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDoc: Document) => {
      // Ensure cloned card has no transition/transform artifacts
      const clonedCard = clonedDoc.querySelector(
        ".invitation-card",
      ) as HTMLElement | null;
      if (clonedCard) {
        clonedCard.style.transition = "none";
        clonedCard.style.transform = "none";
      }
    },
  })
    .then((canvas: HTMLCanvasElement) => {
      const link = document.createElement("a");
      const fileName = guest?.slug
        ? `kartu-undangan-${guest.slug}.png`
        : "kartu-undangan.png";
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      link.click();

      showToast("Kartu berhasil diunduh!");
    })
    .catch((err: unknown) => {
      console.error("Gagal mengunduh kartu:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengunduh kartu.";
      showToast(message, true);
    })
    .finally(() => {
      btn.disabled = false;
      if (btnText) {
        btnText.textContent = "Unduh Kartu";
      }
      card.classList.remove("exporting");
    });
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                         */
/* ------------------------------------------------------------------ */

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
