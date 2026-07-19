// src/main/guestbook.ts
import { supabaseClient } from "./supabase-client";
import { getNama, getGuestId } from "./slug-router";
import { config } from "../config";
import { showRsvpModal } from "./utils";
import { escapeHtml, renderPagination } from "./utils";

const GB_PAGE_SIZE = 5;
let gbCurrentPage = 0;
let gbTotalPages = 0;

const KATA_KASAR = [
  "anjing",
  "babi",
  "bangsat",
  "goblok",
  "tolol",
  "bodoh",
  "kontol",
  "memek",
  "jancok",
  "jancuk",
  "ngentot",
  "bajingan",
  "brengsek",
  "laknat",
  "sialan",
  "kampret",
  "bego",
  "setan",
] as const;

function sensorKataKasar(text: string): boolean {
  for (let i = 0; i < KATA_KASAR.length; i++) {
    if (new RegExp("\\b" + KATA_KASAR[i] + "\\b", "i").test(text)) return true;
  }
  return false;
}

function formatWaktuRelatif(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return Math.floor(diff / 60) + " menit lalu";
  if (diff < 86400) return Math.floor(diff / 3600) + " jam lalu";
  if (diff < 604800) return Math.floor(diff / 86400) + " hari lalu";
  return d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

function showGuestbookState(state: "loading" | "empty" | "error"): void {
  document.getElementById("gb-loading")!.classList.add("d-none");
  document.getElementById("gb-empty")!.classList.add("d-none");
  document.getElementById("gb-error")!.classList.add("d-none");
  document.getElementById("gb-list")!.innerHTML = "";
  document.getElementById("gb-pagination")!.classList.add("d-none");
  if (state === "loading")
    document.getElementById("gb-loading")!.classList.remove("d-none");
  else if (state === "empty")
    document.getElementById("gb-empty")!.classList.remove("d-none");
  else if (state === "error")
    document.getElementById("gb-error")!.classList.remove("d-none");
}

async function submitGuestbook(
  namaInput: string,
  pesanInput: string,
  rsvpId: string | null,
): Promise<void> {
  const res = await fetch(config.GUESTBOOK_EDGE_FUNCTION, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + config.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      nama: namaInput,
      pesan: pesanInput,
      reservation_id: rsvpId || null,
    }),
  });
  if (!res.ok) {
    let errMsg = "Gagal mengirim ucapan. Silakan coba lagi.";
    try {
      const errData = await res.json();
      const raw = String(errData.error || "");
      if (raw && raw !== "{}" && !raw.startsWith('{')) errMsg = raw;
    } catch (_) {
      errMsg = "Server error (" + res.status + ")";
    }
    throw new Error(errMsg);
  }
}

export async function fetchGuestbook(page?: number): Promise<void> {
  showGuestbookState("loading");
  try {
    const p = page ?? 0;
    const from = p * GB_PAGE_SIZE;
    const to = from + GB_PAGE_SIZE - 1;
    const countRes = (await supabaseClient
      .from("guestbook")
      .select("id", { count: "estimated", head: true })
      .eq("is_approved", true)) as unknown as {
      error: unknown;
      count: number | null;
    };
    if (countRes.error) throw countRes.error;
    const total = countRes.count || 0;
    gbTotalPages = Math.max(1, Math.ceil(total / GB_PAGE_SIZE));
    const res = (await supabaseClient
      .from("guestbook")
      .select("name, message, created_at")
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .range(from, to)) as unknown as {
      error: unknown;
      data: Array<{ name: string; message: string; created_at: string }> | null;
    };
    if (res.error) throw res.error;
    const data = res.data || [];
    document.getElementById("gb-list")!.innerHTML = "";
    if (data.length === 0) {
      showGuestbookState("empty");
    } else {
      data.forEach(function (m) {
        const div = document.createElement("div");
        div.className = "gb-entry";
        div.innerHTML =
          '<div class="gb-name">' +
          escapeHtml(m.name) +
          '</div><div class="gb-msg">' +
          escapeHtml(m.message) +
          '</div><div class="gb-time">' +
          formatWaktuRelatif(m.created_at) +
          "</div>";
        document.getElementById("gb-list")!.appendChild(div);
      });
    }
    gbCurrentPage = p;
    renderGuestbookPagination();
  } catch (err) {
    console.error("Gagal memuat ucapan:", err);
    showGuestbookState("error");
  } finally {
    document.getElementById("gb-loading")!.classList.add("d-none");
  }
}

function renderGuestbookPagination(): void {
  renderPagination({
    container: document.getElementById("gb-pagination"),
    currentPage: gbCurrentPage,
    totalPages: gbTotalPages,
    onPageChange: function (page) {
      fetchGuestbook(page);
    },
  });
}

function retryFetchGuestbook(attempt: number = 0): void {
  if (attempt >= 3) {
    fetchGuestbook(0);
    return;
  }
  setTimeout(
    function () {
      if (supabaseClient) {
        fetchGuestbook(0);
      } else {
        retryFetchGuestbook(attempt + 1);
      }
    },
    300 * (attempt + 1),
  );
}

export function initGuestbook(): void {
  const form = document.getElementById("guestbook-form") as HTMLFormElement;
  form.addEventListener("submit", async function (this: HTMLElement, e: Event) {
    e.preventDefault();
    const namaEl = document.getElementById("gb-nama") as HTMLInputElement;
    const pesanEl = document.getElementById("gb-pesan") as HTMLTextAreaElement;
    const errEl = document.createElement("div");
    errEl.className = "gb-error-msg";
    const existing = this.querySelector(".gb-error-msg");
    if (existing) existing.remove();
    const nm = namaEl.value.trim();
    const psn = pesanEl.value.trim();
    if (!nm || !psn) {
      errEl.textContent = "Nama dan ucapan wajib diisi.";
      errEl.classList.add("show");
      this.appendChild(errEl);
      return;
    }
    if (sensorKataKasar(psn)) {
      errEl.textContent =
        "Ucapan mengandung kata tidak pantas. Mohon perbaiki.";
      errEl.classList.add("show");
      this.appendChild(errEl);
      return;
    }
    let gbSuccess = false;
    const span = this.querySelector("#statusMessage")!;
    span.textContent = "Mengirim...";
    try {
      await submitGuestbook(nm, psn, getGuestId());
      showRsvpModal({ message: "Ucapan berhasil dikirim! Terima kasih!" });
      namaEl.value = "";
      pesanEl.value = "";
      document.getElementById("gb-counter")!.textContent = "0/500";
      fetchGuestbook(0);
      gbSuccess = true;
      span.textContent = "Terkirim";
    } catch (err) {
      console.error("Gagal kirim ucapan:", err);
      showRsvpModal({
        message: "Gagal mengirim ucapan. Coba lagi.",
        isError: true,
      });
    } finally {
      if (!gbSuccess) span.textContent = "Kirim Ucapan";
    }
  });

  const gbPesan = document.getElementById("gb-pesan") as HTMLTextAreaElement;
  gbPesan.addEventListener("input", function () {
    document.getElementById("gb-counter")!.textContent =
      gbPesan.value.length + "/500";
  });

  (document.getElementById("gb-nama") as HTMLInputElement).value = getNama();
  retryFetchGuestbook(0);
}
