// src/main/card-page.ts
// Halaman kartu undangan untuk route /[slug]/card.
// Render setelah tamu mengisi RSVP — menampilkan kartu undangan digital
// dengan data tamu, QR code, dan info acara.
// Desain: flexbox, Playfair Display, toggle landscape/portrait.

import { getGuestData, getNama } from "./slug-router";
import html2canvas from "html2canvas";
import QRCode from "qrcodejs";

interface CardData {
  nama: string;
  qrToken: string;
  tanggal: string;
  lokasi: string;
  dressCode: string;
}

/** Tampilkan halaman kartu undangan setelah RSVP sukses */
export function renderCardPage(container: HTMLElement): void {
  const guest = getGuestData();
  if (!guest) {
    container.innerHTML =
      '<p class="text-center text-secondary">Data tamu tidak ditemukan.</p>';
    return;
  }

  const data: CardData = {
    nama: getNama(),
    qrToken: guest.token ?? "",
    tanggal: "Sabtu, 22 Agustus 2026",
    lokasi: "RIVEA Riverside Cafe and Space, Ngaglik, Sleman, DIY",
    dressCode: "Formal / semi-formal",
  };

  container.innerHTML = buildCardHTML(data);
  generateQR(data.qrToken);
  bindEvents();
}

function buildCardHTML(d: CardData): string {
  const slug = getGuestData()?.slug ?? "";

  return `
    <div class="card-page">
      <header class="card-toolbar">
        <div class="card-toolbar__start">
          <a href="/${escAttr(slug)}" class="card-btn-back">
            <span class="card-btn-back__arrow" aria-hidden="true">&#8592;</span>
            <span>Kembali</span>
          </a>
        </div>
        <div class="card-toolbar__center">
          <div class="btn-group card-orientation-toggle" role="group" aria-label="Pilih orientasi kartu">
            <input type="radio" class="btn-check" name="cardOrientation" id="cardOrientationLandscape" autocomplete="off" checked>
            <label class="btn btn-outline-primary" for="cardOrientationLandscape">Landscape</label>
            <input type="radio" class="btn-check" name="cardOrientation" id="cardOrientationPortrait" autocomplete="off">
            <label class="btn btn-outline-primary" for="cardOrientationPortrait">Portrait</label>
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
          <div class="card-body-row">
            <div class="card-body-info">
              <dl class="card-info-list">
                <div class="card-info-row">
                  <dt class="card-info-label">Nama</dt>
                  <dd class="card-info-value">${esc(d.nama)}</dd>
                </div>
                <div class="card-info-row">
                  <dt class="card-info-label">Tanggal</dt>
                  <dd class="card-info-value">${esc(d.tanggal)}</dd>
                </div>
                <div class="card-info-row">
                  <dt class="card-info-label">Lokasi</dt>
                  <dd class="card-info-value">${esc(d.lokasi)}</dd>
                </div>
                <div class="card-info-row">
                  <dt class="card-info-label">Dress code</dt>
                  <dd class="card-info-value">${esc(d.dressCode)}</dd>
                </div>
              </dl>
            </div>
            <div class="card-body-qr">
              <div class="card-qr" id="card-qr" role="img" aria-label="Kode QR undangan"></div>
            </div>
          </div>
          <div class="card-footer-section">
            <p class="card-instruction">Simpan kartu ini dan tunjukkan saat hari acara</p>
          </div>
        </section>

        <div class="card-actions mt-5">
          <button type="button" class="btn-download-card" id="btn-download-card">
            Unduh Kartu
          </button>
        </div>
      </div>
    </div>
  `;
}

function generateQR(token: string): void {
  const el = document.getElementById("card-qr");
  if (!el || !token) return;
  new QRCode(el, {
    text: token,
    width: 300,
    height: 300,
    colorDark: "#000000",
    colorLight: "#ffffff",
  });
}

function bindEvents(): void {
  // Orientation toggle
  const card = document.getElementById("invitationCard");
  const landscapeInput = document.getElementById(
    "cardOrientationLandscape",
  ) as HTMLInputElement;
  const portraitInput = document.getElementById(
    "cardOrientationPortrait",
  ) as HTMLInputElement;

  landscapeInput?.addEventListener("change", () => {
    if (landscapeInput.checked && card) {
      card.classList.remove("portrait");
      card.classList.add("landscape");
    }
  });

  portraitInput?.addEventListener("change", () => {
    if (portraitInput.checked && card) {
      card.classList.remove("landscape");
      card.classList.add("portrait");
    }
  });

  // Download
  document
    .getElementById("btn-download-card")
    ?.addEventListener("click", () => {
      downloadCard();
    });
}

function esc(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function escAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function downloadCard(): void {
  const el = document.querySelector(".invitation-card") as HTMLElement;
  if (!el) return;
  html2canvas(el, { scale: 2, useCORS: true })
    .then((canvas: HTMLCanvasElement) => {
      const link = document.createElement("a");
      link.download = "kartu-undangan.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    })
    .catch((err: unknown) => {
      console.error("Gagal mengunduh kartu:", err);
    });
}
