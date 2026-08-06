// entry point for index.html
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "aos/dist/aos.css";
import "./styles/main.css";
import "./styles/card.css";
import "./styles/circle.css";

import AOS from "aos";

import { config } from "./config";
import { fetchGuestData, routeType, slug, getGuestName } from "./main/slug-router";
import { renderCardPage } from "./main/card-page";
import { initCountdown } from "./main/countdown";
import { supabaseClient } from "./main/supabase-client";
import { enableScroll, showBottomNav } from "./main/navigation";
import { playAudio } from "./main/audio";
import { copyToClipboard } from "./main/utils";
import { generateInviteMessage, copyTextToClipboard, showToast } from "@/shared/ui";
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

function switchOrientation(): void {
  const orientationInputs = document.querySelectorAll<HTMLInputElement>(
    'input[name="orientation"]',
  );

  const card = document.getElementById("invitationCard");

  function setOrientation(orientation: "landscape" | "portrait"): void {
    if (!card) return;
    card.classList.remove("landscape", "portrait");
    card.classList.add(orientation);
  }

  orientationInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;

      setOrientation(
        input.id === "orientation-portrait" ? "portrait" : "landscape",
      );
    });
  });
}

function hideLoading(): void {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.classList.add("is-done");
    // Hapus dari DOM setelah transisi selesai
    setTimeout(() => overlay.remove(), 500);
  }
}

function showOffline(): void {
  hideLoading();
  document.getElementById("offline-overlay")?.classList.remove("d-none");
}

function showError(): void {
  hideLoading();
  document.getElementById("error-overlay")?.classList.remove("d-none");
}

async function checkEventStatus(): Promise<"online" | "offline" | "error"> {
  try {
    const { data, error } = await supabaseClient
      .from("event_config")
      .select("value")
      .eq("key", "event_status")
      .maybeSingle();

    if (error) {
      console.error("[checkEventStatus] query error", { message: error.message, code: error.code, details: error.details });
      return "online";
    }

    if (!data) {
      console.warn("[checkEventStatus] row `event_status` tidak ditemukan — fallback online");
      return "online";
    }

    const val = (data as { value: string }).value;
    // (debug log dihapus)

    let status: string = val;
    if (
      typeof val === "string" &&
      (val === '"online"' || val === '"offline"')
    ) {
      status = JSON.parse(val);
    }
    const result = status === "offline" ? "offline" : "online";
    return result;
  } catch (err) {
    console.error("[checkEventStatus] exception", err);
    return "online";
  }
}

function initShareButton(): void {
  const btn = document.getElementById("btn-share-invite");
  if (!btn) return;
  btn.classList.remove("d-none");
  btn.addEventListener("click", async () => {
    const name = getGuestName();
    const msg = generateInviteMessage(slug, name);
    const ok = await copyTextToClipboard(msg);
    showToast(ok ? "Pesan undangan disalin" : "Gagal menyalin pesan", !ok);
  });
}

// Init modules — async karena fetchGuestData() perlu resolve dulu
async function initApp(): Promise<void> {
  try {
    // Cek status event dengan timeout + minimum display time
    const MIN_LOAD_MS = 2000;
    const TIMEOUT_MS = 5000;
    const startTime = Date.now();

    const statusPromise =
      routeType !== "cover"
        ? checkEventStatus()
        : Promise.resolve("online" as const);

    // Race: status check vs timeout
    let status: "online" | "offline" | "error";
    try {
      const result = await Promise.race([
        statusPromise,
        new Promise<"error">((resolve) =>
          setTimeout(() => resolve("error"), TIMEOUT_MS),
        ),
      ]);
      status = result;
    } catch (err) {
      console.error("[initApp] status check exception", err);
      status = "error";
    }

    // Pastikan loading screen tampil minimal MIN_LOAD_MS
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_LOAD_MS) {
      await new Promise((r) => setTimeout(r, MIN_LOAD_MS - elapsed));
    }

    // Handle status
    if (status === "offline") {
      showOffline();
      return;
    }
    if (status === "error") {
      showError();
      return;
    }

    // Online — sembunyikan loading, lanjutkan init normal
    hideLoading();

    if (routeType !== "cover") {
      await fetchGuestData();
    }

    if (routeType === "card") {
      enableScroll();
      renderCardPage(document.body);
      return;
    }

    // Isi nama tamu di hero untuk rute undangan
    const nama = getGuestName();
    const namaContainer = document.querySelector<HTMLElement>(".hero h4 span");
    if (namaContainer) {
      namaContainer.innerText = nama
        ? " " + nama + ","
        : " Mr/Mrs/Ms Invited Guest,";
    }

    // Tampilkan tombol share undangan
    initShareButton();

    initCountdown();
    initRsvp();
    initGuestbook();
  } catch (err) {
    console.error("[initApp] unhandled exception", err);
    hideLoading();
  }
}

initApp();

// Gantikan inline onClick di index.html (CSP `script-src 'self'` memblokir inline handler)
document.getElementById("btn-error-reload")?.addEventListener("click", () => {
  location.reload();
});

document.querySelectorAll(".btn-copy-rekening").forEach((btn) => {
  btn.addEventListener("click", function () {
    const no = (btn as HTMLElement).dataset.rekening;
    if (no) copyToClipboard(no);
  });
});

document.querySelector(".btn-open-saweria")?.addEventListener("click", () => {
  window.open("https://saweria.co/ChikoeL", "_blank");
});
