// src/main/card-page.ts
// Halaman kartu undangan untuk route /[slug]/card.
// Render setelah tamu mengisi RSVP — menampilkan kartu undangan digital
// dengan data tamu, QR code, dan info acara.

import { getGuestData, getNama } from "./slug-router";
import html2canvas from "html2canvas";
import QRCode from "qrcodejs";

interface CardData {
  nama: string;
  guestCount: number;
  qrToken: string;
  tanggal: string;
  lokasi: string;
  dressCode: string;
}

/** Tampilkan overlay kartu undangan setelah RSVP sukses */
export function renderCardPage(container: HTMLElement): void {
  const guest = getGuestData();
  if (!guest) {
    container.innerHTML = '<p class="text-center text-secondary">Data tamu tidak ditemukan.</p>';
    return;
  }

  const data: CardData = {
    nama: getNama(),
    guestCount: 1,
    qrToken: guest.token ?? "",
    tanggal: "Sabtu, 22 Agustus 2026",
    lokasi: "RIVEA Riverside Cafe and Space, Ngaglik, Sleman, DIY",
    dressCode: "Jas hitam",
  };

  container.innerHTML = buildCardHTML(data);
  generateQR(data.qrToken);

  document.getElementById("btn-download-card")?.addEventListener("click", () => {
    downloadCard();
  });
}

function buildCardHTML(d: CardData): string {
  const slug = getGuestData()?.slug ?? "";
  return `
    <div class="card-page">
      <a href="/${slug}" class="card-back-link">&larr; Kembali</a>
      <div class="card-container">
        <div class="card-header-section">
          <p class="card-label">Kartu Undangan Pernikahan</p>
          <h1 class="card-couple-name">REZA &amp; ASHILA</h1>
        </div>
        <div class="card-body-layout">
          <div class="card-info">
            <table class="card-info-table">
              <tr><td class="card-info-label">Nama</td><td class="card-info-value">${esc(d.nama)}</td></tr>
              <tr><td class="card-info-label">Tanggal</td><td class="card-info-value">${esc(d.tanggal)}</td></tr>
              <tr><td class="card-info-label">Lokasi</td><td class="card-info-value">${esc(d.lokasi)}</td></tr>
              <tr><td class="card-info-label">Dress Code</td><td class="card-info-value">${esc(d.dressCode)}</td></tr>
            </table>
          </div>
          <div class="card-qr-section">
            <div id="card-qr" class="card-qr"></div>
          </div>
        </div>
        <p class="card-instruction">Simpan kartu ini dan tunjukkan saat hari acara</p>
      </div>
      <div class="card-actions">
        <button id="btn-download-card" class="btn-download-card">Unduh Kartu</button>
      </div>
    </div>
  `;
}

function generateQR(token: string): void {
  const el = document.getElementById("card-qr");
  if (!el || !token) return;
  new QRCode(el, {
    text: token,
    width: 200,
    height: 200,
    colorDark: "#000000",
    colorLight: "#ffffff",
  });
}

function esc(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function downloadCard(): void {
  const el = document.querySelector(".card-container") as HTMLElement;
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
