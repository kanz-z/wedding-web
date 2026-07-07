// src/dashboard/operations.js
import { state } from './state';
import { showToast, escapeHtml, escapeAttr } from './utils';
import { config } from '../config';
import { renderDigitalCard, captureCard } from '../shared/card-utils';
import { loadTamuRSVP } from './tamu';

// ---------- batch selection ----------
export function toggleSelectAll(checked) {
  var headerCb = document.getElementById("select-all-header");
  var toolbarCb = document.getElementById("select-all");
  if (headerCb) headerCb.checked = checked;
  if (toolbarCb) toolbarCb.checked = checked;
  document.querySelectorAll(".tamu-checkbox").forEach(function(cb) {
    var tr = cb.closest("tr");
    if (tr && tr.style.display !== "none") { cb.checked = checked; state.selectedTamu[cb.dataset.guestId] = checked; }
  });
  updateBatchButtons();
}

export function toggleSelect(guestId, checked) { state.selectedTamu[guestId] = checked; updateBatchButtons(); }

function updateBatchButtons() {
  var count = 0;
  for (var k in state.selectedTamu) { if (state.selectedTamu[k]) count++; }
  document.getElementById("btn-download-kartu").disabled = count === 0;
  document.getElementById("btn-hapus").disabled = count === 0;
  document.getElementById("selected-count").textContent = count > 0 ? count + " tamu dipilih" : "";
}

// ---------- import ----------
export function showImportModal() {
  document.getElementById("import-modal").classList.add("show");
  document.getElementById("import-result").style.display = "none";
  document.getElementById("import-text").value = "";
  document.getElementById("import-csv-file").value = "";
  document.getElementById("import-csv-preview").innerHTML = "";
  switchImportTab("paste");
}

export function closeImportModal() { document.getElementById("import-modal").classList.remove("show"); }

export function switchImportTab(tab) {
  document.getElementById("import-pane-paste").style.display = tab === "paste" ? "block" : "none";
  document.getElementById("import-pane-csv").style.display = tab === "csv" ? "block" : "none";
  document.getElementById("import-tab-paste").classList.toggle("active", tab === "paste");
  document.getElementById("import-tab-csv").classList.toggle("active", tab === "csv");
}

export async function executeImport() {
  var raw = document.getElementById("import-text").value.trim();
  if (!raw) { showToast("Tidak ada data untuk diimport.", true); return; }
  var lines = raw.split("\n").filter(Boolean);
  var results = { success: [], warnings: [], errors: [] };
  for (var i = 0; i < lines.length; i++) {
    var parts = lines[i].split(",").map(function(s) { return s.trim(); });
    var name = parts[0] || "";
    var side = (parts[1] || "").toLowerCase();
    var invitedCount = parseInt(parts[2]) || 1;
    var nomorWa = (parts[3] || "").replace(/[\s\-\(\)]/g, "");
    if (!name) { results.errors.push("Baris " + (i + 1) + ": nama kosong"); continue; }
    if (name.length > 100) { results.errors.push("Baris " + (i + 1) + ": nama terlalu panjang"); continue; }
    if (side && !["pria", "wanita", "both"].includes(side)) { results.errors.push("Baris " + (i + 1) + ": side '" + side + "' tidak valid"); continue; }
    if (nomorWa && !/^\d{10,15}$/.test(nomorWa)) { results.warnings.push("Baris " + (i + 1) + " (" + name + "): nomor WA diabaikan (format tidak valid)"); nomorWa = ""; }
    if (!parts[2] || isNaN(parseInt(parts[2]))) { results.warnings.push("Baris " + (i + 1) + " (" + name + "): invited_count tidak terbaca, default 1"); }
    var baseSlug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!baseSlug) baseSlug = "tamu-" + Date.now();
    var slug = baseSlug;
    var slugNum = 1;
    var slugRes;
    while (true) {
      slugRes = await state.dashboardSb.from("guests").select("id").eq("slug", slug).maybeSingle();
      if (slugRes.error) { results.errors.push("Baris " + (i + 1) + ": error cek slug"); break; }
      if (!slugRes.data) break;
      slug = baseSlug + "-" + slugNum++;
    }
    if (slugRes && slugRes.error) continue;
    var guestRes = await state.dashboardSb.from("guests").insert([{ slug: slug, name: name, side: side || null, invited_count: invitedCount, nomor_wa: nomorWa || null }]).select("id").single();
    if (guestRes.error) { results.errors.push("Baris " + (i + 1) + " (" + name + "): " + guestRes.error.message); continue; }
    var rsvpRes = await state.dashboardSb.from("rsvps").insert([{ guest_id: guestRes.data.id, nama: name, nomor_wa: nomorWa || null, jumlah_hadir: invitedCount, status: "belum", is_approved: true }]);
    if (rsvpRes.error) {
      await state.dashboardSb.from("guests").delete().eq("id", guestRes.data.id);
      results.errors.push("Baris " + (i + 1) + " (" + name + "): gagal simpan RSVP"); continue;
    }
    results.success.push(name);
  }
  var resultDiv = document.getElementById("import-result");
  resultDiv.style.display = "block";
  var html = "<strong>Import selesai</strong><br><span style='color:#51cf66;'>\u2713 Berhasil: " + results.success.length + "</span><br>";
  if (results.warnings.length > 0) html += "<span style='color:#ffd43b;'>\u26A0 Peringatan: " + results.warnings.length + "</span><br><small>" + results.warnings.join("<br>") + "</small><br>";
  if (results.errors.length > 0) html += "<span style='color:#ff6b6b;'>\u2717 Gagal: " + results.errors.length + "</span><br><small>" + results.errors.join("<br>") + "</small>";
  resultDiv.innerHTML = html;
  resultDiv.className = results.errors.length > 0 ? "error" : "success";
  if (results.success.length > 0) { showToast(results.success.length + " tamu berhasil diimport."); closeImportModal(); loadTamuRSVP(); }
}

// ---------- batch delete ----------
export async function confirmBatchDelete() {
  var selected = state.allTamu.filter(function(t) { return state.selectedTamu[t.guest_id]; });
  if (selected.length === 0) return;
  var visibleIds = {};
  var search = (document.getElementById("tamu-search").value || "").toLowerCase();
  state.allTamu.forEach(function(t) {
    var matchSearch = !search || t.nama.toLowerCase().indexOf(search) !== -1;
    var matchFilter = true;
    if (state.tamuFilter === "pending") matchFilter = t.is_approved === false;
    else if (state.tamuFilter === "orphan") matchFilter = t._source === "orphan" || t._source === "auto-matched";
    else if (state.tamuFilter === "pria") matchFilter = t._side === "pria";
    else if (state.tamuFilter === "wanita") matchFilter = t._side === "wanita";
    else if (state.tamuFilter === "belum") matchFilter = !t.status || t.status === "belum";
    else if (state.tamuFilter !== "all") matchFilter = t.status === state.tamuFilter;
    if (matchSearch && matchFilter) visibleIds[t.guest_id] = true;
  });
  var hidden = selected.filter(function(t) { return !visibleIds[t.guest_id]; });
  if (hidden.length > 0) { if (!confirm(hidden.length + " tamu terpilih tidak terlihat karena filter/pencarian. Tetap hapus semua " + selected.length + " tamu?")) return; }
  else { if (!confirm("Yakin ingin menghapus " + selected.length + " tamu terpilih?")) return; }
  var alreadyFilled = selected.filter(function(t) { return t.status && t.status !== "belum"; });
  if (alreadyFilled.length > 0) {
    var names = alreadyFilled.map(function(t) { return t.nama; }).join(", ");
    if (!confirm(alreadyFilled.length + " tamu sudah mengisi RSVP (" + names + ").\nData RSVP akan hilang permanen. Tetap hapus?")) return;
  }
  await executeBatchDelete(selected);
}

async function executeBatchDelete(selected) {
  showToast("Menghapus " + selected.length + " tamu...");
  try {
    var guestIds = selected.map(function(t) { return t.guest_id; });
    var rsvpRes = await state.dashboardSb.from("rsvps").select("id").in("guest_id", guestIds);
    if (rsvpRes.error) throw rsvpRes.error;
    if (rsvpRes.data && rsvpRes.data.length > 0) {
      var rsvpIds = rsvpRes.data.map(function(r) { return r.id; });
      await state.dashboardSb.from("guest_checkins").delete().in("rsvp_id", rsvpIds);
      await state.dashboardSb.from("rsvps").delete().in("guest_id", guestIds);
    }
    await state.dashboardSb.from("guests").delete().in("id", guestIds);
    selected.forEach(function(t) { delete state.selectedTamu[t.guest_id]; });
    updateBatchButtons();
    showToast(selected.length + " tamu berhasil dihapus.");
    loadTamuRSVP();
  } catch(err) { console.error("Batch delete error:", err); showToast("Gagal menghapus. Coba lagi.", true); }
}

// ---------- batch download ----------
function canGenerateCard(guest) { return guest && guest.id && guest.status && guest.status !== "belum"; }

export function cancelBatchDownload() { state._cancelDownload = true; document.getElementById("progress-text").textContent = "Membatalkan..."; }

function showProgressModal(msg, total) {
  document.getElementById("progress-modal").style.display = "flex";
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("progress-text").textContent = msg;
  state._cancelDownload = false;
}

function updateProgress(current, total, name) {
  var pct = Math.round((current / total) * 100);
  document.getElementById("progress-bar").style.width = pct + "%";
  document.getElementById("progress-text").textContent = "Memproses: " + escapeHtml(name) + " (" + current + "/" + total + ")";
}

function closeProgressModal() { document.getElementById("progress-modal").style.display = "none"; }

export async function downloadBatchKartu() {
  var selected = state.allTamu.filter(function(t) { return state.selectedTamu[t.guest_id]; });
  if (selected.length === 0) return;
  var valid = selected.filter(canGenerateCard);
  var invalid = selected.filter(function(t) { return !canGenerateCard(t); });
  if (invalid.length > 0) showToast(invalid.length + " tamu belum RSVP - tidak dibuatkan kartu.", true);
  if (valid.length === 0) { showToast("Tidak ada tamu yang bisa dibuatkan kartu.", true); return; }
  showProgressModal("Menyiapkan kartu...", valid.length);
  var successCount = 0;
  if (typeof window.jspdf === "undefined") {
    closeProgressModal();
    for (var i = 0; i < valid.length; i++) {
      if (state._cancelDownload) break;
      updateProgress(i + 1, valid.length, valid[i].nama);
      try {
        var canvas = await generateSingleCard(valid[i]);
        var link = document.createElement("a");
        link.download = "Kartu-" + valid[i].nama.replace(/\s+/g, "-") + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        successCount++;
      } catch(err) { console.error("Gagal kartu:", valid[i].nama, err); }
    }
    if (state._cancelDownload) showToast("Dibatalkan. " + successCount + " kartu berhasil dibuat sebelum batal.");
    else if (successCount === valid.length) showToast(successCount + " kartu didownload (PNG).");
    else showToast(successCount + " dari " + valid.length + " kartu berhasil dibuat.", true);
    return;
  }
  var { jsPDF } = window.jspdf;
  var pdf = new jsPDF("l", "mm", "a6");
  for (var i = 0; i < valid.length; i++) {
    if (state._cancelDownload) break;
    updateProgress(i + 1, valid.length, valid[i].nama);
    try {
      var canvas = await generateSingleCard(valid[i]);
      var imgData = canvas.toDataURL("image/jpeg", 0.92);
      if (successCount > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, 148, 105);
      successCount++;
    } catch(err) { console.error("Gagal kartu:", valid[i].nama, err); }
  }
  if (!state._cancelDownload && successCount > 0) { pdf.save("Kartu-Undangan-" + new Date().toISOString().slice(0, 10) + ".pdf"); }
  closeProgressModal();
  if (state._cancelDownload) showToast("Dibatalkan. " + successCount + " kartu berhasil dibuat sebelum batal.");
  else if (successCount === valid.length) showToast(successCount + " kartu berhasil didownload.");
  else showToast(successCount + " dari " + valid.length + " kartu berhasil dibuat.", true);
}

async function generateSingleCard(guest) {
  if (!canGenerateCard(guest)) throw new Error("Tamu belum RSVP - tidak dapat membuat kartu.");
  var token = guest.qr_token;
  if (!token) {
    token = crypto.randomUUID();
    var updateRes = await state.dashboardSb.from("rsvps").update({ qr_token: token }).eq("id", guest.id).select("qr_token").single();
    if (updateRes.error) throw updateRes.error;
    token = updateRes.data.qr_token;
  }
  var template = document.getElementById("digital-card-html");
  var container = document.getElementById("card-render-container");
  container.innerHTML = "";
  var clone = template.content.cloneNode(true);
  container.appendChild(clone);
  renderDigitalCard(container, { nama: guest.nama, pronoun: guest._pronoun, invited_count: guest._invited_count, status: guest.status, qr_token: token, guest_id: guest.guest_id });
  await new Promise(function(r) { setTimeout(r, 400); });
  return await captureCard(container);
}
