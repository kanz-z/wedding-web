// src/dashboard/operations.ts
import { state } from './state';
import { showToast, escapeHtml, escapeAttr } from './utils';
import { config } from '../config';
import { renderDigitalCard, captureCard } from '../shared/card-utils';
import { loadTamuRSVP } from './tamu';

/** Internal row shape — matches what loadTamuRSVP builds */
interface TamuEntry {
  id: string | null;
  guest_id: string;
  nama: string;
  nomor_wa: string;
  jumlah_hadir: number;
  status: string | null;
  is_approved: boolean;
  checked_in: boolean;
  qr_token: string | null;
  pesan: string | null;
  created_at: string;
  _slug: string | null;
  _pronoun: string | null;
  _invited_count: number;
  _source: string;
  _side: string | null;
}

// ---------- batch selection ----------
export function toggleSelectAll(checked: boolean): void {
  const headerCb = document.getElementById("select-all-header") as HTMLInputElement | null;
  const toolbarCb = document.getElementById("select-all") as HTMLInputElement | null;
  if (headerCb) headerCb.checked = checked;
  if (toolbarCb) toolbarCb.checked = checked;
  document.querySelectorAll<HTMLInputElement>(".tamu-checkbox").forEach(function(cb) {
    const tr = cb.closest("tr") as HTMLElement | null;
    if (tr && tr.style.display !== "none") {
      cb.checked = checked;
      state.selectedTamu[cb.dataset.guestId!] = checked;
    }
  });
  updateBatchButtons();
}

export function toggleSelect(guestId: string, checked: boolean): void {
  state.selectedTamu[guestId] = checked;
  updateBatchButtons();
}

function updateBatchButtons(): void {
  let count = 0;
  for (const k in state.selectedTamu) { if (state.selectedTamu[k]) count++; }
  const btnDownload = document.getElementById("btn-download-kartu") as HTMLButtonElement | null;
  const btnHapus = document.getElementById("btn-hapus") as HTMLButtonElement | null;
  const countEl = document.getElementById("selected-count");
  if (btnDownload) btnDownload.disabled = count === 0;
  if (btnHapus) btnHapus.disabled = count === 0;
  if (countEl) countEl.textContent = count > 0 ? count + " tamu dipilih" : "";
}

// ---------- import ----------
export function showImportModal(): void {
  const modal = document.getElementById("import-modal");
  if (modal) modal.classList.add("show");
  const resultEl = document.getElementById("import-result");
  if (resultEl) resultEl.style.display = "none";
  const textEl = document.getElementById("import-text") as HTMLTextAreaElement | null;
  if (textEl) textEl.value = "";
  const fileEl = document.getElementById("import-csv-file") as HTMLInputElement | null;
  if (fileEl) fileEl.value = "";
  const preview = document.getElementById("import-csv-preview");
  if (preview) preview.innerHTML = "";
  switchImportTab("paste");
}

export function closeImportModal(): void {
  const modal = document.getElementById("import-modal");
  if (modal) modal.classList.remove("show");
}

export function switchImportTab(tab: string): void {
  const panePaste = document.getElementById("import-pane-paste");
  const paneCsv = document.getElementById("import-pane-csv");
  const tabPaste = document.getElementById("import-tab-paste");
  const tabCsv = document.getElementById("import-tab-csv");
  if (panePaste) panePaste.style.display = tab === "paste" ? "block" : "none";
  if (paneCsv) paneCsv.style.display = tab === "csv" ? "block" : "none";
  if (tabPaste) tabPaste.classList.toggle("active", tab === "paste");
  if (tabCsv) tabCsv.classList.toggle("active", tab === "csv");
}

interface ImportResults {
  success: string[];
  warnings: string[];
  errors: string[];
}

export async function executeImport(): Promise<void> {
  const textEl = document.getElementById("import-text") as HTMLTextAreaElement | null;
  const raw = (textEl ? textEl.value : "").trim();
  if (!raw) { showToast("Tidak ada data untuk diimport.", true); return; }
  const lines = raw.split("\n").filter(Boolean);
  const results: ImportResults = { success: [], warnings: [], errors: [] };
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(",").map(function(s: string) { return s.trim(); });
    const name = parts[0] || "";
    const side = (parts[1] || "").toLowerCase();
    const invitedCount = parseInt(parts[2]) || 1;
    let nomorWa = (parts[3] || "").replace(/[\s\-\(\)]/g, "");
    if (!name) { results.errors.push("Baris " + (i + 1) + ": nama kosong"); continue; }
    if (name.length > 100) { results.errors.push("Baris " + (i + 1) + ": nama terlalu panjang"); continue; }
    if (side && !["pria", "wanita", "both"].includes(side)) { results.errors.push("Baris " + (i + 1) + ": side '" + side + "' tidak valid"); continue; }
    if (nomorWa && !/^\d{10,15}$/.test(nomorWa)) { results.warnings.push("Baris " + (i + 1) + " (" + name + "): nomor WA diabaikan (format tidak valid)"); nomorWa = ""; }
    if (!parts[2] || isNaN(parseInt(parts[2]))) { results.warnings.push("Baris " + (i + 1) + " (" + name + "): invited_count tidak terbaca, default 1"); }
    let baseSlug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!baseSlug) baseSlug = "tamu-" + Date.now();
    let slug = baseSlug;
    let slugNum = 1;
    type SlugRow = { id: string };
    let slugRes: { data: SlugRow | null; error: { message: string } | null } | undefined;
    while (true) {
      slugRes = await state.dashboardSb.from("guests").select("id").eq("slug", slug).maybeSingle() as unknown as { data: SlugRow | null; error: { message: string } | null };
      if (slugRes.error) { results.errors.push("Baris " + (i + 1) + ": error cek slug"); break; }
      if (!slugRes.data) break;
      slug = baseSlug + "-" + slugNum++;
    }
    if (slugRes && slugRes.error) continue;
    const guestRes = await state.dashboardSb.from("guests").insert([{ slug, name, side: side || null, invited_count: invitedCount, nomor_wa: nomorWa || null }]).select("id").single() as unknown as { data: { id: string } | null; error: { message: string } | null };
    if (guestRes.error) { results.errors.push("Baris " + (i + 1) + " (" + name + "): " + guestRes.error.message); continue; }
    const rsvpRes = await state.dashboardSb.from("rsvps").insert([{ guest_id: guestRes.data!.id, nama: name, nomor_wa: nomorWa || null, jumlah_hadir: invitedCount, status: "belum", is_approved: true }]) as unknown as { error: { message: string } | null };
    if (rsvpRes.error) {
      await state.dashboardSb.from("guests").delete().eq("id", guestRes.data!.id);
      results.errors.push("Baris " + (i + 1) + " (" + name + "): gagal simpan RSVP"); continue;
    }
    results.success.push(name);
  }
  const resultDiv = document.getElementById("import-result");
  if (resultDiv) {
    resultDiv.style.display = "block";
    let html = "<strong>Import selesai</strong><br><span style='color:#51cf66;'>✓ Berhasil: " + results.success.length + "</span><br>";
    if (results.warnings.length > 0) html += "<span style='color:#ffd43b;'>⚠ Peringatan: " + results.warnings.length + "</span><br><small>" + results.warnings.join("<br>") + "</small><br>";
    if (results.errors.length > 0) html += "<span style='color:#ff6b6b;'>✗ Gagal: " + results.errors.length + "</span><br><small>" + results.errors.join("<br>") + "</small>";
    resultDiv.innerHTML = html;
    resultDiv.className = results.errors.length > 0 ? "error" : "success";
  }
  if (results.success.length > 0) { showToast(results.success.length + " tamu berhasil diimport."); closeImportModal(); loadTamuRSVP(); }
}

// ---------- batch delete ----------
export async function confirmBatchDelete(): Promise<void> {
  const allTamu = state.allTamu as TamuEntry[];
  const selected = allTamu.filter(function(t) { return state.selectedTamu[t.guest_id]; });
  if (selected.length === 0) return;
  const visibleIds: Record<string, boolean> = {};
  const search = ((document.getElementById("tamu-search") as HTMLInputElement | null)?.value || "").toLowerCase();
  allTamu.forEach(function(t) {
    const matchSearch = !search || t.nama.toLowerCase().indexOf(search) !== -1;
    let matchFilter = true;
    if (state.tamuFilter === "pending") matchFilter = t.is_approved === false;
    else if (state.tamuFilter === "orphan") matchFilter = t._source === "orphan" || t._source === "auto-matched";
    else if (state.tamuFilter === "pria") matchFilter = t._side === "pria";
    else if (state.tamuFilter === "wanita") matchFilter = t._side === "wanita";
    else if (state.tamuFilter === "belum") matchFilter = !t.status || t.status === "belum";
    else if (state.tamuFilter !== "all") matchFilter = t.status === state.tamuFilter;
    if (matchSearch && matchFilter) visibleIds[t.guest_id] = true;
  });
  const hidden = selected.filter(function(t) { return !visibleIds[t.guest_id]; });
  if (hidden.length > 0) { if (!confirm(hidden.length + " tamu terpilih tidak terlihat karena filter/pencarian. Tetap hapus semua " + selected.length + " tamu?")) return; }
  else { if (!confirm("Yakin ingin menghapus " + selected.length + " tamu terpilih?")) return; }
  const alreadyFilled = selected.filter(function(t) { return t.status && t.status !== "belum"; });
  if (alreadyFilled.length > 0) {
    const names = alreadyFilled.map(function(t) { return t.nama; }).join(", ");
    if (!confirm(alreadyFilled.length + " tamu sudah mengisi RSVP (" + names + ").\nData RSVP akan hilang permanen. Tetap hapus?")) return;
  }
  await executeBatchDelete(selected);
}

async function executeBatchDelete(selected: TamuEntry[]): Promise<void> {
  showToast("Menghapus " + selected.length + " tamu...");
  try {
    const guestIds = selected.map(function(t) { return t.guest_id; });
    const rsvpRes = await state.dashboardSb.from("rsvps").select("id").in("guest_id", guestIds) as unknown as { data: { id: string }[] | null; error: { message: string } | null };
    if (rsvpRes.error) throw rsvpRes.error;
    if (rsvpRes.data && rsvpRes.data.length > 0) {
      const rsvpIds = rsvpRes.data.map(function(r) { return r.id; });
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
function canGenerateCard(guest: TamuEntry): boolean {
  return !!guest && !!guest.id && !!guest.status && guest.status !== "belum";
}

export function cancelBatchDownload(): void {
  state._cancelDownload = true;
  const progressText = document.getElementById("progress-text");
  if (progressText) progressText.textContent = "Membatalkan...";
}

function showProgressModal(msg: string, total: number): void {
  const modal = document.getElementById("progress-modal");
  const bar = document.getElementById("progress-bar") as HTMLElement | null;
  const text = document.getElementById("progress-text");
  if (modal) modal.style.display = "flex";
  if (bar) bar.style.width = "0%";
  if (text) text.textContent = msg;
  state._cancelDownload = false;
}

function updateProgress(current: number, total: number, name: string): void {
  const pct = Math.round((current / total) * 100);
  const bar = document.getElementById("progress-bar") as HTMLElement | null;
  const text = document.getElementById("progress-text");
  if (bar) bar.style.width = pct + "%";
  if (text) text.textContent = "Memproses: " + escapeHtml(name) + " (" + current + "/" + total + ")";
}

function closeProgressModal(): void {
  const modal = document.getElementById("progress-modal");
  if (modal) modal.style.display = "none";
}

export async function downloadBatchKartu(): Promise<void> {
  const allTamu = state.allTamu as TamuEntry[];
  const selected = allTamu.filter(function(t) { return state.selectedTamu[t.guest_id]; });
  if (selected.length === 0) return;
  const valid = selected.filter(canGenerateCard);
  const invalid = selected.filter(function(t) { return !canGenerateCard(t); });
  if (invalid.length > 0) showToast(invalid.length + " tamu belum RSVP - tidak dibuatkan kartu.", true);
  if (valid.length === 0) { showToast("Tidak ada tamu yang bisa dibuatkan kartu.", true); return; }
  showProgressModal("Menyiapkan kartu...", valid.length);
  let successCount = 0;
  // jsPDF loaded from CDN — no TS types available
  if (typeof (window as unknown as Record<string, unknown>).jspdf === "undefined") {
    closeProgressModal();
    for (let i = 0; i < valid.length; i++) {
      if (state._cancelDownload) break;
      updateProgress(i + 1, valid.length, valid[i].nama);
      try {
        const canvas = await generateSingleCard(valid[i]);
        const link = document.createElement("a");
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf CDN lib without types
  const { jsPDF } = (window as any).jspdf as { jsPDF: new (...args: unknown[]) => { addPage: () => void; addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number) => void; save: (name: string) => void } };
  const pdf = new jsPDF("l", "mm", "a6");
  for (let i = 0; i < valid.length; i++) {
    if (state._cancelDownload) break;
    updateProgress(i + 1, valid.length, valid[i].nama);
    try {
      const canvas = await generateSingleCard(valid[i]);
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
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

async function generateSingleCard(guest: TamuEntry): Promise<HTMLCanvasElement> {
  if (!canGenerateCard(guest)) throw new Error("Tamu belum RSVP - tidak dapat membuat kartu.");
  let token = guest.qr_token;
  if (!token) {
    token = crypto.randomUUID();
    const updateRes = await state.dashboardSb.from("rsvps").update({ qr_token: token }).eq("id", guest.id).select("qr_token").single() as unknown as { data: { qr_token: string } | null; error: { message: string } | null };
    if (updateRes.error) throw updateRes.error;
    token = updateRes.data!.qr_token;
  }
  const template = document.getElementById("digital-card-html") as HTMLTemplateElement | null;
  const container = document.getElementById("card-render-container");
  if (!template || !container) throw new Error("Card template or container not found.");
  container.innerHTML = "";
  const clone = template.content.cloneNode(true);
  container.appendChild(clone);
  renderDigitalCard(container, { nama: guest.nama, pronoun: guest._pronoun ?? undefined, invited_count: guest._invited_count, status: guest.status ?? undefined, qr_token: token, guest_id: guest.guest_id });
  await new Promise<void>(function(r) { setTimeout(r, 400); });
  return await captureCard(container);
}
