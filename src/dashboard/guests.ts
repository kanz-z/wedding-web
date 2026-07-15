// src/dashboard/guests.ts — Kelola Tamu: tabel, search, filter, sort, pagination, bulk, modal, group picker

import { escapeHtml, formatTime, badge, showToast, show, hide } from '@/shared/ui';
import { GUESTS, guestMeta, currentPage, pageSize, sortKey, sortDir, searchQuery, filters, selectedIds, resetFilters, setCurrentPage, setSortKey, setSearchQuery, checkinStatus } from './state';
import { showModal } from './ui';
import type { Reservation } from '@/types/supabase';
import type { GuestCheckin } from './state';

// --- Derived helpers ---
function gMeta(g: Reservation): GuestCheckin { return guestMeta[g.id] ?? { checkedIn: 0, checkedInAt: null, rsvp: "belum", flag: null }; }
function gStatus(meta: GuestCheckin, g: Reservation) { return checkinStatus(meta, g.guest_count); }

function rsvpBadge(rsvp: string): string {
  if (rsvp === "hadir") return badge("success", "Hadir");
  if (rsvp === "tidak") return badge("danger", "Tidak Hadir");
  return badge("muted", "Belum Respon");
}

function checkinBadgeText(status: string): string {
  if (status === "sudah") return badge("success", "Sudah Hadir");
  if (status === "sebagian") return badge("warning", "Sebagian");
  return badge("muted", "Belum Hadir");
}

function kategoriBadge(k: string): string {
  return k === "keluarga" ? badge("info", "Keluarga") : badge("purple", "Bukan Keluarga");
}

// --- Filter / sort ---
function getFilteredGuests(): Reservation[] {
  return GUESTS.filter((g) => {
    const meta = gMeta(g);
    if (searchQuery) {
      const hay = [g.name, g.nomor_wa ?? "", g.kelompok ?? "", g.id].join(" ").toLowerCase();
      if (!hay.includes(searchQuery.toLowerCase())) return false;
    }
    if (filters.checkin && gStatus(meta, g) !== filters.checkin) return false;
    if (filters.rsvp && meta.rsvp !== filters.rsvp) return false;
    if (filters.kategori && g.kategori !== filters.kategori) return false;
    if (filters.kelompok && g.kelompok !== filters.kelompok) return false;
    return true;
  });
}

function getSortedGuests(list: Reservation[]): Reservation[] {
  return [...list].sort((a, b) => {
    const ma = gMeta(a), mb = gMeta(b);
    let av = "", bv = "";
    if (sortKey === "checkinTime") { av = ma.checkedInAt ?? ""; bv = mb.checkedInAt ?? ""; }
    else if (sortKey === "checkinStatus") { av = gStatus(ma, a); bv = gStatus(mb, b); }
    else { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

// --- Row rendering ---
function renderGuestRow(g: Reservation): string {
  const meta = gMeta(g);
  const status = gStatus(meta, g);
  const classes = [status === "sudah" ? "is-checked-in" : "", status === "sebagian" ? "is-partial" : "", selectedIds.has(g.id) ? "is-selected" : ""].filter(Boolean).join(" ");
  const editedHtml = g.edited_status === "rsvp" ? badge("pink", "RSVP") : g.edited_status === "admin" ? badge("muted", "Admin") : '<span class="edited-dash">–</span>';
  const flagHtml = meta.flag ? `<i class="bi bi-exclamation-triangle-fill anomaly-flag" title="${escapeHtml(meta.flag)}"></i>` : "";
  const checkinDisabled = status === "sudah" || meta.rsvp !== "hadir" ? "is-disabled" : "";
  return `<tr class="${classes}" data-id="${g.id}">
    <td><input type="checkbox" class="row-check" ${selectedIds.has(g.id) ? "checked" : ""} data-select="${g.id}" aria-label="Pilih ${escapeHtml(g.name)}"></td>
    <td><span class="guest-name">${escapeHtml(g.name)} ${flagHtml}</span></td>
    <td><button type="button" class="kelompok-chip" data-kelompok>${escapeHtml(g.kelompok || "Tanpa kelompok")}</button></td>
    <td>${kategoriBadge(g.kategori)}</td><td class="text-end">${g.guest_count} orang</td>
    <td class="mono-time">${escapeHtml(g.nomor_wa ?? "–")}</td><td>${rsvpBadge(meta.rsvp)}</td><td>${checkinBadgeText(status)}</td>
    <td class="mono-time">${formatTime(meta.checkedInAt)}</td><td>${editedHtml}</td>
    <td><div class="row-actions">
      <button type="button" data-action="detail" data-id="${g.id}" title="Detail" aria-label="Detail ${escapeHtml(g.name)}"><i class="bi bi-eye"></i></button>
      <button type="button" data-action="edit" data-id="${g.id}" title="Edit" aria-label="Edit ${escapeHtml(g.name)}"><i class="bi bi-pencil"></i></button>
      <button type="button" data-action="checkin" data-id="${g.id}" title="Check-in" aria-label="Check-in ${escapeHtml(g.name)}" class="${checkinDisabled}"><i class="bi bi-qr-code-scan"></i></button>
    </div></td></tr>`;
}

// --- Table render ---
export function renderGuestTable(): void {
  const filtered = getFilteredGuests();
  const sorted = getSortedGuests(filtered);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  if (currentPage >= totalPages) setCurrentPage(totalPages - 1);
  const start = currentPage * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);
  const tbody = document.getElementById("guest-tbody");
  hide(document.getElementById("guest-empty-first")); hide(document.getElementById("guest-error"));
  if (sorted.length === 0) { hide(document.getElementById("guest-table-wrap")); show(document.getElementById("guest-empty")); }
  else { show(document.getElementById("guest-table-wrap")); hide(document.getElementById("guest-empty")); if (tbody) tbody.innerHTML = pageItems.map(renderGuestRow).join(""); }
  const infoEl = document.getElementById("guest-pagination-info");
  if (infoEl) infoEl.textContent = sorted.length === 0 ? "Tidak ada tamu yang cocok" : `Menampilkan ${start + 1}–${Math.min(start + pageItems.length, sorted.length)} dari ${sorted.length} tamu`;
  renderPaginationNav(totalPages);
}

function renderPaginationNav(totalPages: number): void {
  const ul = document.getElementById("guest-pagination"); if (!ul) return; ul.innerHTML = ""; if (totalPages <= 1) return;
  const pi = (label: string, enabled: boolean, active: boolean, cb: () => void) => {
    const li = document.createElement("li"); li.className = "page-item" + (enabled ? "" : " disabled") + (active ? " active" : "");
    const a = document.createElement("a"); a.className = "page-link"; a.href = "#"; a.innerHTML = label;
    a.addEventListener("click", (e) => { e.preventDefault(); if (enabled) cb(); }); li.appendChild(a); return li;
  };
  ul.appendChild(pi("&laquo;", currentPage > 0, false, () => { setCurrentPage(currentPage - 1); renderGuestTable(); }));
  for (let i = 0; i < totalPages; i++) ul.appendChild(pi(String(i + 1), true, i === currentPage, ((p) => () => { setCurrentPage(p); renderGuestTable(); })(i)));
  ul.appendChild(pi("&raquo;", currentPage < totalPages - 1, false, () => { setCurrentPage(currentPage + 1); renderGuestTable(); }));
}

// --- Filter population ---
function populateKelompokFilter(): void {
  const sel = document.getElementById("filter-kelompok") as HTMLSelectElement | null; if (!sel) return;
  sel.innerHTML = '<option value="">Semua Kelompok</option>' + [...new Set(GUESTS.map((g) => g.kelompok).filter(Boolean))].map((g) => `<option value="${escapeHtml(g!)}">${escapeHtml(g!)}</option>`).join("");
}

export function flashRow(id: string): void { requestAnimationFrame(() => { const tr = document.querySelector(`tr[data-id="${id}"]`); tr?.classList.add("is-flash"); setTimeout(() => tr?.classList.remove("is-flash"), 650); }); }

// --- Bulk bar ---
function updateBulkBar(): void {
  const bar = document.getElementById("bulk-bar"); if (!bar) return;
  if (selectedIds.size > 0) { bar.classList.remove("d-none-important"); const c = document.getElementById("bulk-count"); if (c) c.textContent = String(selectedIds.size); }
  else bar.classList.add("d-none-important");
}

// --- Modal detail ---
let activeGuestId: string | null = null;
export function openGuestModal(id: string): void {
  const g = GUESTS.find((x) => x.id === id); const meta = guestMeta[id]; if (!g || !meta) return; activeGuestId = id;
  const status = gStatus(meta, g);
  const nameEl = document.getElementById("modal-guest-name"); if (nameEl) nameEl.textContent = g.name;
  let html = '<dl class="detail-grid">';
  html += `<dt>Kelompok</dt><dd>${escapeHtml(g.kelompok || "–")}</dd><dt>Kategori</dt><dd>${g.kategori === "keluarga" ? "Keluarga" : "Bukan Keluarga"}</dd><dt>Jumlah Tamu</dt><dd>${g.guest_count} orang</dd><dt>No. WhatsApp</dt><dd>${escapeHtml(g.nomor_wa ?? "–")}</dd><dt>Status RSVP</dt><dd>${rsvpBadge(meta.rsvp)}</dd><dt>Status Check-in</dt><dd>${checkinBadgeText(status)} <span class="mono-time">(${meta.checkedIn}/${g.guest_count})</span></dd><dt>Waktu Check-in</dt><dd>${meta.checkedInAt ? formatTime(meta.checkedInAt) : "Belum check-in"}</dd><dt>Diedit oleh</dt><dd>${g.edited_status === "rsvp" ? "Tamu (via RSVP)" : g.edited_status === "admin" ? "Admin" : "–"}</dd>`;
  if (meta.flag) html += `<dt>Catatan</dt><dd style="color:var(--warning)"><i class="bi bi-exclamation-triangle-fill"></i> ${escapeHtml(meta.flag)}</dd>`;
  html += "</dl>";
  const bodyEl = document.getElementById("modal-guest-body"); if (bodyEl) bodyEl.innerHTML = html;
  const checkinBtn = document.getElementById("modal-checkin-btn") as HTMLButtonElement | null;
  if (checkinBtn) { checkinBtn.disabled = status === "sudah" || meta.rsvp !== "hadir"; checkinBtn.innerHTML = status === "sudah" ? '<i class="bi bi-check2-circle"></i> Sudah Check-in' : '<i class="bi bi-qr-code-scan"></i> Check-in'; }
  showModal("guest-modal-overlay");
}

// --- Manual check-in ---
function doManualCheckin(id: string): void {
  const meta = guestMeta[id]; const g = GUESTS.find((x) => x.id === id); if (!meta || !g) return;
  const delta = g.guest_count - meta.checkedIn > 0 ? g.guest_count - meta.checkedIn : g.guest_count;
  meta.checkedIn += delta; meta.checkedInAt = new Date().toISOString();
  renderGuestTable(); flashRow(id); showToast(g.name + " berhasil check-in (+" + delta + ")"); window.dispatchEvent(new CustomEvent("checkin-updated"));
}

// --- State previews ---
function showGuestState(state: string): void {
  hide(document.getElementById("guest-table-wrap")); hide(document.getElementById("guest-empty")); hide(document.getElementById("guest-empty-first")); hide(document.getElementById("guest-error"));
  if (state === "empty-first") show(document.getElementById("guest-empty-first"));
  if (state === "error") show(document.getElementById("guest-error"));
}

// --- Group picker ---
let activeKelompokGuestId: string | null = null;
function openGroupPicker(chip: HTMLElement): void {
  activeKelompokGuestId = chip.closest("tr")?.dataset.id ?? null; const picker = document.getElementById("group-picker"); if (!picker) return;
  const rect = chip.getBoundingClientRect(); picker.style.top = (window.scrollY + rect.bottom + 6) + "px"; picker.style.left = (window.scrollX + rect.left) + "px";
  const groups = [...new Set(GUESTS.map((g) => g.kelompok).filter(Boolean))];
  const list = document.getElementById("group-picker-list"); if (list) list.innerHTML = groups.map((n) => `<button type="button" class="group-picker__item" data-group="${escapeHtml(n!)}"><span class="group-picker__dot"></span>${escapeHtml(n!)}</button>`).join("");
  picker.classList.add("show"); document.getElementById("group-new-input")?.focus();
}
function closeGroupPicker(): void { document.getElementById("group-picker")?.classList.remove("show"); activeKelompokGuestId = null; }

// --- Guest table init (dipanggil oleh page-changed event dari routing) ---
export function initGuestTable(): void {
  const skel = document.getElementById("guest-skeleton"); hide(document.getElementById("guest-table-wrap")); show(skel);
  setTimeout(() => { hide(skel); populateKelompokFilter(); renderGuestTable(); }, 650);
}

// --- Event bindings ---
export function initGuestEvents(): void {
  document.querySelectorAll<HTMLElement>(".guest-table th.is-sortable").forEach((th) => {
    const apply = () => { const k = th.dataset.sort; if (k) setSortKey(k); renderGuestTable(); };
    th.addEventListener("click", apply); th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apply(); } });
  });
  const si = document.getElementById("guest-search") as HTMLInputElement | null;
  si?.addEventListener("input", function () { setSearchQuery(this.value.trim()); document.getElementById("search-box")?.classList.toggle("has-value", !!searchQuery); renderGuestTable(); });
  document.getElementById("search-clear")?.addEventListener("click", () => { if (si) si.value = ""; setSearchQuery(""); document.getElementById("search-box")?.classList.remove("has-value"); renderGuestTable(); si?.focus(); });
  ["checkin", "rsvp", "kategori", "kelompok"].forEach((k) => document.getElementById("filter-" + k)?.addEventListener("change", function (this: HTMLSelectElement) { filters[k] = this.value; setCurrentPage(0); renderGuestTable(); }));
  document.getElementById("filter-drawer-toggle")?.addEventListener("click", () => document.getElementById("filter-group")?.classList.toggle("drawer-open"));
  document.getElementById("page-size-select")?.addEventListener("change", function (this: HTMLSelectElement) { (window as any).pageSize = parseInt(this.value, 10); setCurrentPage(0); renderGuestTable(); });
  document.getElementById("guest-empty-reset")?.addEventListener("click", () => { resetFilters(); renderGuestTable(); });

  document.getElementById("guest-tbody")?.addEventListener("click", function (e) {
    const t = e.target as HTMLElement; const d = t.closest<HTMLElement>('[data-action="detail"]'), ed = t.closest<HTMLElement>('[data-action="edit"]'), c = t.closest<HTMLElement>('[data-action="checkin"]'), ch = t.closest<HTMLElement>("[data-kelompok]");
    if (d) openGuestModal(d.dataset.id!); else if (ed) openGuestModal(ed.dataset.id!); else if (c && !c.classList.contains("is-disabled")) doManualCheckin(c.dataset.id!); else if (ch) openGroupPicker(ch);
  });
  document.getElementById("guest-tbody")?.addEventListener("change", function (e) {
    const cb = (e.target as HTMLElement).closest<HTMLInputElement>(".row-check"); if (!cb) return; const id = cb.dataset.select!;
    if (cb.checked) selectedIds.add(id); else selectedIds.delete(id); cb.closest("tr")?.classList.toggle("is-selected", cb.checked); updateBulkBar();
  });
  document.getElementById("bulk-resend")?.addEventListener("click", () => showToast(selectedIds.size + " undangan dikirim ulang (demo)"));
  document.getElementById("bulk-clear")?.addEventListener("click", () => { selectedIds.clear(); updateBulkBar(); renderGuestTable(); });
  document.getElementById("btn-simulate-update")?.addEventListener("click", () => {
    const pool = GUESTS.filter((g) => { const m = gMeta(g); return gStatus(m, g) !== "sudah" && m.rsvp === "hadir"; });
    if (!pool.length) { showToast("Semua tamu RSVP hadir sudah check-in"); return; }
    const g = pool[Math.floor(Math.random() * pool.length)]; const m = guestMeta[g.id]; m.checkedIn = Math.min(g.guest_count, m.checkedIn + 1); m.checkedInAt = new Date().toISOString();
    renderGuestTable(); flashRow(g.id); showToast("Update realtime: " + g.name + " check-in");
  });
  document.getElementById("modal-checkin-btn")?.addEventListener("click", () => { if (activeGuestId) { doManualCheckin(activeGuestId); openGuestModal(activeGuestId); } });

  document.getElementById("group-picker-list")?.addEventListener("click", (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>(".group-picker__item"); if (!item || !activeKelompokGuestId) return;
    const g = GUESTS.find((x) => x.id === activeKelompokGuestId); if (g) g.kelompok = item.dataset.group ?? null; closeGroupPicker(); populateKelompokFilter(); renderGuestTable(); showToast("Kelompok diperbarui");
  });
  document.getElementById("group-add-btn")?.addEventListener("click", () => {
    const inp = document.getElementById("group-new-input") as HTMLInputElement | null; const val = inp?.value.trim(); if (!val || !activeKelompokGuestId) return;
    const g = GUESTS.find((x) => x.id === activeKelompokGuestId); if (g) g.kelompok = val; if (inp) inp.value = ""; closeGroupPicker(); populateKelompokFilter(); renderGuestTable(); showToast("Kelompok baru dibuat & diterapkan");
  });
  document.addEventListener("click", (e) => { const picker = document.getElementById("group-picker"); if (picker?.classList.contains("show") && !picker.contains(e.target as Node) && !(e.target as HTMLElement).closest("[data-kelompok]")) closeGroupPicker(); });

  document.getElementById("preview-empty")?.addEventListener("click", (e) => { e.preventDefault(); showGuestState("empty-first"); });
  document.getElementById("preview-error")?.addEventListener("click", (e) => { e.preventDefault(); showGuestState("error"); });
  document.getElementById("preview-reset")?.addEventListener("click", (e) => { e.preventDefault(); renderGuestTable(); });
  document.getElementById("guest-error-retry")?.addEventListener("click", () => { showToast("Data berhasil dimuat ulang"); renderGuestTable(); });
  document.getElementById("guest-empty-first-cta")?.addEventListener("click", () => renderGuestTable());
}
