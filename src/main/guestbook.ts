// src/main/guestbook.ts
import { supabaseClient } from "./supabase-client";
import { getGuestName, getGuestId } from "./slug-router";
import { config } from "../config";
import { showRsvpModal } from "./utils";
import { escapeHtml, renderPagination } from "./utils";
import { formatRelativeTime } from "@/shared/ui";

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

function showGuestbookState(state: "loading" | "empty" | "error"): void {
  document.getElementById("gb-loading")?.classList.add("d-none");
  document.getElementById("gb-empty")?.classList.add("d-none");
  document.getElementById("gb-error")?.classList.add("d-none");
  const list = document.getElementById("gb-list");
  if (list) list.innerHTML = "";
  document.getElementById("gb-pagination")?.classList.add("d-none");
  if (state === "loading")
    document.getElementById("gb-loading")?.classList.remove("d-none");
  else if (state === "empty")
    document.getElementById("gb-empty")?.classList.remove("d-none");
  else if (state === "error")
    document.getElementById("gb-error")?.classList.remove("d-none");
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
    const listEl = document.getElementById("gb-list");
    if (listEl) listEl.innerHTML = "";
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
          formatRelativeTime(m.created_at) +
          "</div>";
        listEl?.appendChild(div);
      });
    }
    gbCurrentPage = p;
    renderGuestbookPagination();
  } catch (err) {
    console.error("Gagal memuat ucapan:", err);
    showGuestbookState("error");
  } finally {
    document.getElementById("gb-loading")?.classList.add("d-none");
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
  const form = document.getElementById("guestbook-form") as HTMLFormElement | null;
  if (!form) return;
  form.addEventListener("submit", async function (this: HTMLElement, e: Event) {
    e.preventDefault();
    const namaEl = document.getElementById("gb-nama") as HTMLInputElement | null;
    const pesanEl = document.getElementById("gb-pesan") as HTMLTextAreaElement | null;
    if (!namaEl || !pesanEl) return;
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
    const span = this.querySelector("#statusMessage");
    if (span) span.textContent = "Mengirim...";
    try {
      await submitGuestbook(nm, psn, getGuestId());
      showRsvpModal({ message: "Ucapan berhasil dikirim! Terima kasih!" });
      namaEl.value = "";
      pesanEl.value = "";
      const counter = document.getElementById("gb-counter");
      if (counter) counter.textContent = "0/500";
      fetchGuestbook(0);
      gbSuccess = true;
      if (span) span.textContent = "Terkirim";
    } catch (err) {
      console.error("Gagal kirim ucapan:", err);
      showRsvpModal({
        message: "Gagal mengirim ucapan. Coba lagi.",
        isError: true,
      });
    } finally {
      if (span && !gbSuccess) span.textContent = "Kirim Ucapan";
    }
  });

  const gbPesan = document.getElementById("gb-pesan") as HTMLTextAreaElement | null;
  if (gbPesan) {
    gbPesan.addEventListener("input", function () {
      const counter = document.getElementById("gb-counter");
      if (counter) counter.textContent = gbPesan.value.length + "/500";
    });
  }

  const gbNama = document.getElementById("gb-nama") as HTMLInputElement | null;
  if (gbNama) gbNama.value = getGuestName();
  retryFetchGuestbook(0);

  // Gantikan inline onClick (CSP `script-src 'self'` memblokir inline handler)
  document.getElementById("btn-gb-retry")?.addEventListener("click", () => {
    fetchGuestbook(0);
  });
}
