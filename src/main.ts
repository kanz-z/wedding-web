// entry point for index.html
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "aos/dist/aos.css";
import "./styles/main.css";
import "./styles/card.css";
import "./styles/circle.css";

import AOS from "aos";

import { config } from "./config";
import { fetchGuestData, routeType, getNama } from "./main/slug-router";
import { renderCardPage } from "./main/card-page";
import { initCountdown } from "./main/countdown";
import { supabaseClient } from "./main/supabase-client";
import { enableScroll, showBottomNav } from "./main/navigation";
import { playAudio } from "./main/audio";
import { copyToClipboard } from "./main/utils";
import { initRsvp } from "./main/rsvp";
import { initGuestbook, fetchGuestbook } from "./main/guestbook";

import "./main/navigation";
import "./main/audio";

AOS.init({ duration: 800, easing: "ease-out-cubic", once: true, offset: 80 });
window.addEventListener("load", function () {
  AOS.refresh();
});

window.enableScroll = function () {
  enableScroll();
  playAudio();
};
window.showBottomNav = showBottomNav;
window.copyToClipboard = copyToClipboard;
window.fetchGuestbook = fetchGuestbook;

// Init modules — async karena fetchGuestData() perlu resolve dulu
async function initApp(): Promise<void> {
  if (routeType !== "cover") {
    await fetchGuestData();
  }

  if (routeType === "card") {
    renderCardPage(document.body);
    return;
  }

  // Isi nama tamu di hero untuk rute undangan
  const nama = getNama();
  const namaContainer = document.querySelector<HTMLElement>(".hero h4 span");
  if (namaContainer) {
    namaContainer.innerText = nama
      ? " " + nama + ","
      : " Mr/Mrs/Ms Invited Guest,";
  }

  initCountdown();
  initRsvp();
  initGuestbook();
}

initApp();
