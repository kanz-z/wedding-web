// src/shared/card-utils.js
import { config } from "../config";
import QRCode from "qrcodejs";
import html2canvas from "html2canvas";

export function renderDigitalCard(container, data) {
  container.querySelector(".dc-nama").textContent =
    (data.pronoun ? data.pronoun + " " : "") + data.nama;
  var statusEl = container.querySelector(".dc-status");
  if (data.status && data.status !== "belum") {
    statusEl.textContent = data.status;
    statusEl.style.display = "block";
  } else {
    statusEl.style.display = "none";
  }
  container.querySelector(".dc-kuota").textContent =
    data.invited_count + " orang";
  var qrContainer = container.querySelector(".dc-qr");
  qrContainer.innerHTML = "";
  var qrUrl = config.SITE_URL + "/?n=" + encodeURIComponent(data.nama);
  if (data.guest_id) qrUrl += "&guest_id=" + data.guest_id;
  if (data.qr_token) qrUrl += "&token=" + data.qr_token;
  new QRCode(qrContainer, { text: qrUrl, width: 130, height: 130 });
}

export function captureCard(container) {
  return html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: null,
  });
}
