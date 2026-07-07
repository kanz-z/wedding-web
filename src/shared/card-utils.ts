// src/shared/card-utils.ts
import { config } from "../config";
import QRCode from "qrcodejs";
import html2canvas from "html2canvas";

export interface DigitalCardData {
  nama: string;
  pronoun?: string;
  invited_count: number;
  status?: string;
  qr_token?: string;
  guest_id?: string;
}

export function renderDigitalCard(
  container: HTMLElement,
  data: DigitalCardData
): void {
  const namaEl = container.querySelector<HTMLElement>(".dc-nama");
  if (namaEl) {
    namaEl.textContent = (data.pronoun ? data.pronoun + " " : "") + data.nama;
  }

  const statusEl = container.querySelector<HTMLElement>(".dc-status");
  if (statusEl) {
    if (data.status && data.status !== "belum") {
      statusEl.textContent = data.status;
      statusEl.style.display = "block";
    } else {
      statusEl.style.display = "none";
    }
  }

  const kuotaEl = container.querySelector<HTMLElement>(".dc-kuota");
  if (kuotaEl) {
    kuotaEl.textContent = data.invited_count + " orang";
  }

  const qrContainer = container.querySelector<HTMLElement>(".dc-qr");
  if (qrContainer) {
    qrContainer.innerHTML = "";
    let qrUrl = config.SITE_URL + "/?n=" + encodeURIComponent(data.nama);
    if (data.guest_id) qrUrl += "&guest_id=" + data.guest_id;
    if (data.qr_token) qrUrl += "&token=" + data.qr_token;
    new QRCode(qrContainer, { text: qrUrl, width: 130, height: 130 });
  }
}

export function captureCard(container: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: null,
  });
}
