// src/main/guestbook.js
import { supabaseClient } from './supabase-client';
import { nama } from './url-params';
import { showRsvpModal } from './utils';
import { escapeHtml, renderPagination } from './utils';

var GB_PAGE_SIZE = 5;
var gbCurrentPage = 0;
var gbTotalPages = 0;

var KATA_KASAR = ["anjing","babi","bangsat","goblok","tolol","bodoh","kontol","memek","jancok","jancuk","ngentot","bajingan","brengsek","laknat","sialan","kampret","bego","setan"];

function sensorKataKasar(text) {
  for (var i = 0; i < KATA_KASAR.length; i++) {
    if (new RegExp("\\b" + KATA_KASAR[i] + "\\b", "i").test(text)) return true;
  }
  return false;
}

function formatWaktuRelatif(iso) {
  var now = new Date();
  var d = new Date(iso);
  var diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return Math.floor(diff / 60) + " menit lalu";
  if (diff < 86400) return Math.floor(diff / 3600) + " jam lalu";
  if (diff < 604800) return Math.floor(diff / 86400) + " hari lalu";
  return d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

function showGuestbookState(state) {
  document.getElementById("gb-loading").classList.add("d-none");
  document.getElementById("gb-empty").classList.add("d-none");
  document.getElementById("gb-error").classList.add("d-none");
  document.getElementById("gb-list").innerHTML = "";
  document.getElementById("gb-pagination").classList.add("d-none");
  if (state === "loading") document.getElementById("gb-loading").classList.remove("d-none");
  else if (state === "empty") document.getElementById("gb-empty").classList.remove("d-none");
  else if (state === "error") document.getElementById("gb-error").classList.remove("d-none");
}

async function submitGuestbook(namaInput, pesanInput, rsvpId) {
  var res = await supabaseClient.from("guestbook").insert([{ rsvp_id: rsvpId || null, nama: namaInput, pesan: pesanInput }]);
  if (res.error) throw res.error;
}

export async function fetchGuestbook(page) {
  showGuestbookState("loading");
  try {
    var from = page * GB_PAGE_SIZE;
    var to = from + GB_PAGE_SIZE - 1;
    var countRes = await supabaseClient.from("guestbook").select("id", { count: "estimated", head: true }).eq("is_approved", true);
    if (countRes.error) throw countRes.error;
    var total = countRes.count || 0;
    gbTotalPages = Math.max(1, Math.ceil(total / GB_PAGE_SIZE));
    var res = await supabaseClient.from("guestbook").select("nama, pesan, created_at").eq("is_approved", true).order("created_at", { ascending: false }).range(from, to);
    if (res.error) throw res.error;
    var data = res.data || [];
    document.getElementById("gb-list").innerHTML = "";
    if (data.length === 0) {
      showGuestbookState("empty");
    } else {
      data.forEach(function(m) {
        var div = document.createElement("div");
        div.className = "gb-entry";
        div.innerHTML = '<div class="gb-name">' + escapeHtml(m.nama) + '</div><div class="gb-msg">' + escapeHtml(m.pesan) + '</div><div class="gb-time">' + formatWaktuRelatif(m.created_at) + "</div>";
        document.getElementById("gb-list").appendChild(div);
      });
    }
    gbCurrentPage = page;
    renderGuestbookPagination();
  } catch (err) {
    console.error("Gagal memuat ucapan:", err);
    showGuestbookState("error");
  } finally {
    document.getElementById("gb-loading").classList.add("d-none");
  }
}

function renderGuestbookPagination() {
  renderPagination({
    container: document.getElementById("gb-pagination"),
    currentPage: gbCurrentPage,
    totalPages: gbTotalPages,
    onPageChange: function(page) { fetchGuestbook(page); },
  });
}

function retryFetchGuestbook(attempt) {
  attempt = attempt || 0;
  if (attempt >= 3) { fetchGuestbook(0); return; }
  setTimeout(function() {
    if (supabaseClient) { fetchGuestbook(0); } else { retryFetchGuestbook(attempt + 1); }
  }, 300 * (attempt + 1));
}

export function initGuestbook() {
  document.getElementById("guestbook-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    var namaEl = document.getElementById("gb-nama");
    var pesanEl = document.getElementById("gb-pesan");
    var errEl = document.createElement("div");
    errEl.className = "gb-error-msg";
    var existing = this.querySelector(".gb-error-msg");
    if (existing) existing.remove();
    var nm = namaEl.value.trim();
    var psn = pesanEl.value.trim();
    if (!nm || !psn) {
      errEl.textContent = "Nama dan ucapan wajib diisi.";
      errEl.classList.add("show");
      this.appendChild(errEl);
      return;
    }
    if (sensorKataKasar(psn)) {
      errEl.textContent = "Ucapan mengandung kata tidak pantas. Mohon perbaiki.";
      errEl.classList.add("show");
      this.appendChild(errEl);
      return;
    }
    var gbSuccess = false;
    var span = this.querySelector("#statusMessage");
    span.textContent = "Mengirim...";
    try {
      await submitGuestbook(nm, psn, null);
      showRsvpModal("Ucapan berhasil dikirim! Terima kasih.", false);
      namaEl.value = "";
      pesanEl.value = "";
      document.getElementById("gb-counter").textContent = "0/500";
      fetchGuestbook(0);
      gbSuccess = true;
      span.textContent = "Terkirim";
    } catch (err) {
      console.error("Gagal kirim ucapan:", err);
      showRsvpModal("Gagal mengirim ucapan. Coba lagi.", true);
    } finally {
      if (!gbSuccess) span.textContent = "Kirim Ucapan";
    }
  });

  document.getElementById("gb-pesan").addEventListener("input", function() {
    document.getElementById("gb-counter").textContent = this.value.length + "/500";
  });

  document.getElementById("gb-nama").value = nama;
  retryFetchGuestbook(0);
}
