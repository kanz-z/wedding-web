// entry point for index.html
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "aos/dist/aos.css";
import "./styles/main.css";
import "./styles/card.css";
import "./styles/circle.css";

import AOS from "aos";

import { config } from "./config";
import { fetchGuestData, routeType, slug, getNama } from "./main/slug-router";
import { initCountdown } from "./main/countdown";
import { supabaseClient } from "./main/supabase-client";
import { enableScroll, showBottomNav } from "./main/navigation";
import { playAudio } from "./main/audio";
import { copyToClipboard } from "./main/utils";
import { initRsvp } from "./main/rsvp";
import { initGuestbook, fetchGuestbook } from "./main/guestbook";
import { renderCardPage } from "./main/card-page";

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

// ---------------------------------------------------------------------------
// Slug-based routing init
// ---------------------------------------------------------------------------
async function initApp(): Promise<void> {
  // Route kartu undangan — render halaman terpisah tanpa UI undangan
  if (routeType === "card") {
    await fetchGuestData();
    const app = document.getElementById("app");
    if (app) {
      renderCardPage(app);
      return;
    }
    // fallback: render ke body
    renderCardPage(document.body);
    return;
  }

  // Fetch data tamu untuk route undangan
  if (routeType !== "cover") {
    await fetchGuestData();
  }

  const nama = getNama();

  // Isi nama tamu di hero
  const namaContainer = document.querySelector<HTMLElement>(".hero h4 span");
  if (namaContainer) {
    if (!nama) {
      namaContainer.innerText = " Mr/Mrs/Ms Invited Guest,";
    } else {
      namaContainer.innerText = " " + nama + ",";
    }
  }

  // Init modules yang bergantung pada data tamu
  initCountdown();
  initRsvp();
  initGuestbook();
}

initApp();
