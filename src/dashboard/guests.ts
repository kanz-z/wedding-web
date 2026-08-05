// src/dashboard/guests.ts — Kelola Tamu: data fetching, tabel, search, filter, sort, pagination, bulk, modal, CRUD
// Fase 4: terhubung Supabase

import {
  escapeHtml,
  escapeAttr,
  formatTime,
  badge,
  showToast,
  show,
  hide,
  debounce,
} from "@/shared/ui";
import {
  guestList,
  currentPage,
  pageSize,
  sortKey,
  sortDir,
  searchQuery,
  filters,
  selectedIds,
  resetFilters,
  setCurrentPage,
  setSortKey,
  setSearchQuery,
  setPageSize,
  checkinStatus,
  getGuestSummary,
  getAnomalyCount,
  getAnomalySnapshot,
  fetchGuests,
  insertGuest,
  updateGuest,
  addCheckin,
  undoCheckin,
  fetchCheckinLog,
  setupRealtime,
  deleteGuests,
} from "./state";
import { showModal, hideModal, renderNotifications } from "./ui";
import { supabase } from "./supabase-client";
import { config } from "@/config";
import type { GuestWithMeta, CheckinLogEntry } from "./state";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import QRCode from "qrcode";

// --- WhatsApp blast state ---
let waBlastTargetIds: string[] = [];
let waBlastIndex = 0;
let waBlastSent = 0;
let waBlastErrors = 0;

// --- Validator helpers ---
function isValidWa(wa: string | null | undefined): boolean {
  if (!wa) return true; // null/empty valid — WA opsional
  const digits = wa.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

// --- Derived helpers ---
function getGuestStatus(g: GuestWithMeta) {
  return checkinStatus(g);
}

function rsvpBadge(status: string): string {
  if (status === "hadir") return badge("success", "Hadir");
  if (status === "tidak") return badge("danger", "Tidak Hadir");
  return badge("muted", "Belum Respon");
}

function checkinBadgeText(status: string): string {
  if (status === "sudah") return badge("success", "Sudah Hadir");
  if (status === "sebagian") return badge("warning", "Sebagian");
  return badge("muted", "Belum Hadir");
}

function kategoriBadge(kategori: string): string {
  return kategori === "keluarga"
    ? badge("info", "Keluarga")
    : badge("purple", "Bukan Keluarga");
}

// --- Summary cards (4.3) ---
export function renderSummaryCards(): void {
  const s = getGuestSummary();
  const cards = document.querySelectorAll<HTMLElement>(".guest-summary-card");
  if (cards.length < 6) return;
  const vals = [
    s.total,
    s.hadirRsvp,
    s.tidakRsvp,
    s.belumRsvp,
    s.sudahCheckin,
    s.belumCheckin,
  ];
  // Gunakan i % 6 karena ada beberapa grup 6 card di halaman berbeda (Hub + Kelola Tamu)
  cards.forEach((c, i) => {
    const valEl = c.querySelector(".summary-card__value");
    if (valEl) valEl.textContent = String(vals[i % 6] ?? 0);
  });

  // GAP-014: badge anomali
  const anomalyBadge = document.getElementById("anomaly-badge");
  if (anomalyBadge) {
    const count = getAnomalyCount();
    anomalyBadge.textContent = String(count);
    anomalyBadge.style.display = count > 0 ? "" : "none";
  }
}

// --- Filter / sort ---
function getFilteredGuests(): GuestWithMeta[] {
  return guestList.filter((g) => {
    if (searchQuery) {
      const hay = [g.name, g.nomor_wa ?? "", g.slug, g.kelompok ?? ""]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(searchQuery.toLowerCase())) return false;
    }
    if (filters.checkin && getGuestStatus(g) !== filters.checkin) return false;
    if (filters.rsvp && g.rsvp !== filters.rsvp) return false;
    if (filters.kategori && g.kategori !== filters.kategori) return false;
    if (filters.kelompok && g.kelompok !== filters.kelompok) return false;
    return true;
  });
}

function getSortedGuests(list: GuestWithMeta[]): GuestWithMeta[] {
  return [...list].sort((a, b) => {
    let av = "",
      bv = "";
    if (sortKey === "checkinTime") {
      av = a.checkedInAt ?? "";
      bv = b.checkedInAt ?? "";
    } else if (sortKey === "checkinStatus") {
      av = getGuestStatus(a);
      bv = getGuestStatus(b);
    } else {
      av = a.name.toLowerCase();
      bv = b.name.toLowerCase();
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

// --- Row rendering (4.2) ---
function renderGuestRow(g: GuestWithMeta): string {
  const status = getGuestStatus(g);
  const rowClass = [
    status === "sudah" ? "is-checked-in" : "",
    status === "sebagian" ? "is-partial" : "",
    selectedIds.has(g.id) ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const editedHtml =
    g.edited_status === "rsvp"
      ? badge("pink", "RSVP")
      : g.edited_status === "admin"
        ? badge("muted", "Admin")
        : g.edited_status === "couple"
          ? badge("pink", "Mempelai")
          : '<span class="edited-dash">–</span>';

  const flagHtml = g.flag
    ? `<i class="bi bi-exclamation-triangle-fill anomaly-flag" title="${escapeAttr(g.flag)}"></i>`
    : "";

  const cDisabled =
    status === "sudah" || g.rsvp !== "hadir" ? "is-disabled" : "";

  return `<tr class="${rowClass}" data-id="${g.id}">
    <td><input type="checkbox" class="row-check" ${selectedIds.has(g.id) ? "checked" : ""} data-select="${g.id}" aria-label="Pilih ${escapeAttr(g.name)}"></td>
    <td><span class="guest-name">${escapeHtml(g.name)} ${flagHtml}</span></td>
    <td><button type="button" class="kelompok-chip" data-kelompok>${escapeHtml(g.kelompok || "Tanpa kelompok")}</button></td>
    <td>${kategoriBadge(g.kategori)}</td><td class="text-end">${g.guest_count} orang</td>
    <td class="mono-time">${escapeHtml(g.nomor_wa ?? "–")}</td><td>${rsvpBadge(g.rsvp)}</td><td>${checkinBadgeText(status)}</td>
    <td class="mono-time">${formatTime(g.checkedInAt)}</td><td>${editedHtml}</td>
    <td><div class="row-actions">
      <button type="button" data-action="detail" data-id="${g.id}" title="Detail" aria-label="Detail ${escapeAttr(g.name)}"><i class="bi bi-eye"></i></button>
      <button type="button" data-action="edit" data-id="${g.id}" title="Edit" aria-label="Edit ${escapeAttr(g.name)}"><i class="bi bi-pencil"></i></button>
      <button type="button" data-action="checkin" data-id="${g.id}" title="Check-in" aria-label="Check-in ${escapeAttr(g.name)}" class="${cDisabled}"><i class="bi bi-qr-code-scan"></i></button>
      <button type="button" data-action="wa" data-id="${g.id}" title="${!g.nomor_wa ? "Tamu tidak memiliki nomor WhatsApp" : "Kirim WA"}" aria-label="Kirim WA ke ${escapeAttr(g.name)}" ${!g.nomor_wa ? "disabled" : ""}><i class="bi bi-whatsapp"></i></button>
      <button type="button" data-action="download" data-id="${g.id}" title="Unduh Kartu" aria-label="Unduh kartu ${escapeAttr(g.name)}"><i class="bi bi-download"></i></button>
    </div></td></tr>`;
}

// --- Sort indicators ---
function updateSortIndicators(): void {
  document
    .querySelectorAll<HTMLElement>(".guest-table th.is-sortable i")
    .forEach((icon) => {
      icon.className = "bi bi-arrow-down-up";
    });
  const th = document.querySelector<HTMLElement>(
    `.guest-table th.is-sortable[data-sort="${sortKey}"] i`,
  );
  if (th)
    th.className = sortDir === "asc" ? "bi bi-sort-up" : "bi bi-sort-down";
}

// --- Select-all (4.11) ---
function getPageItems(): GuestWithMeta[] {
  const filtered = getFilteredGuests();
  const sorted = getSortedGuests(filtered);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  if (currentPage >= totalPages) setCurrentPage(totalPages - 1);
  const start = Math.max(0, currentPage) * pageSize;
  return sorted.slice(start, start + pageSize);
}

function updateSelectAll(): void {
  const cb = document.getElementById(
    "select-all-guests",
  ) as HTMLInputElement | null;
  if (!cb) return;
  const pageItems = getPageItems();
  const pageIds = new Set(pageItems.map((g) => g.id));
  const selected = pageItems.filter((g) => selectedIds.has(g.id));
  cb.checked = pageItems.length > 0 && selected.length === pageItems.length;
  cb.indeterminate = selected.length > 0 && selected.length < pageItems.length;
}

// --- Bulk bar (4.12) ---
function updateBulkBar(): void {
  const bar = document.getElementById("bulk-bar");
  if (!bar) return;
  if (selectedIds.size > 0) {
    bar.classList.remove("d-none-important");
    const c = document.getElementById("bulk-count");
    if (c) c.textContent = String(selectedIds.size);
  } else {
    bar.classList.add("d-none-important");
  }
}

// --- Table render (4.2) ---
export function renderGuestTable(): void {
  const filtered = getFilteredGuests();
  const sorted = getSortedGuests(filtered);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  if (currentPage >= totalPages) setCurrentPage(totalPages - 1);
  const start = Math.max(0, currentPage) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);
  const tbody = document.getElementById("guest-tbody");

  hide(document.getElementById("guest-empty-first"));
  hide(document.getElementById("guest-error"));

  if (sorted.length === 0) {
    hide(document.getElementById("guest-table-wrap"));
    const firstLoad =
      guestList.length === 0 &&
      !searchQuery &&
      !Object.values(filters).some(Boolean);
    show(
      firstLoad
        ? document.getElementById("guest-empty-first")
        : document.getElementById("guest-empty"),
    );
  } else {
    show(document.getElementById("guest-table-wrap"));
    hide(document.getElementById("guest-empty"));
    if (tbody) tbody.innerHTML = pageItems.map(renderGuestRow).join("");
  }

  updateSortIndicators();
  updateSelectAll();
  updateBulkBar();

  const infoEl = document.getElementById("guest-pagination-info");
  if (infoEl) {
    infoEl.textContent =
      sorted.length === 0
        ? "Tidak ada tamu yang cocok"
        : `Menampilkan ${start + 1}–${Math.min(start + pageItems.length, sorted.length)} dari ${sorted.length} tamu`;
  }
  renderPaginationNav(totalPages);
  renderSummaryCards();
}

function renderPaginationNav(totalPages: number): void {
  const ul = document.getElementById("guest-pagination");
  if (!ul) return;
  ul.innerHTML = "";
  if (totalPages <= 1) return;

  const createPageItem = (
    label: string,
    enabled: boolean,
    active: boolean,
    cb: () => void,
  ) => {
    const li = document.createElement("li");
    li.className =
      "page-item" + (enabled ? "" : " disabled") + (active ? " active" : "");
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.innerHTML = label;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (enabled) cb();
    });
    li.appendChild(a);
    return li;
  };

  ul.appendChild(
    createPageItem("&laquo;", currentPage > 0, false, () => {
      setCurrentPage(currentPage - 1);
      renderGuestTable();
    }),
  );
  for (let i = 0; i < totalPages; i++) {
    ul.appendChild(
      createPageItem(
        String(i + 1),
        true,
        i === currentPage,
        ((p) => () => {
          setCurrentPage(p);
          renderGuestTable();
        })(i),
      ),
    );
  }
  ul.appendChild(
    createPageItem("&raquo;", currentPage < totalPages - 1, false, () => {
      setCurrentPage(currentPage + 1);
      renderGuestTable();
    }),
  );
}

// --- Filter population ---
export function populateKelompokFilter(): void {
  const sel = document.getElementById(
    "filter-kelompok",
  ) as HTMLSelectElement | null;
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML =
    '<option value="">Semua Kelompok</option>' +
    [...new Set(guestList.map((g) => g.kelompok).filter(Boolean))]
      .map(
        (g) => `<option value="${escapeAttr(g!)}">${escapeHtml(g!)}</option>`,
      )
      .join("");
  sel.value = cur;
}

export function flashRow(id: string): void {
  requestAnimationFrame(() => {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    tr?.classList.add("is-flash");
    setTimeout(() => tr?.classList.remove("is-flash"), 650);
  });
}

// --- Modal detail (4.14) ---
let activeGuestId: string | null = null;

export function openGuestModal(id: string): void {
  const g = guestList.find((x) => x.id === id);
  if (!g) return;
  activeGuestId = id;
  const status = getGuestStatus(g);

  const nameEl = document.getElementById("modal-guest-name");
  if (nameEl) nameEl.textContent = g.name;

  let html = '<dl class="detail-grid">';
  html += `<dt>Kelompok</dt><dd>${escapeHtml(g.kelompok || "–")}</dd>`;
  html += `<dt>Kategori</dt><dd>${g.kategori === "keluarga" ? "Keluarga" : "Bukan Keluarga"}</dd>`;
  html += `<dt>Jumlah Tamu</dt><dd>${g.guest_count} orang</dd>`;
  html += `<dt>No. WhatsApp</dt><dd>${escapeHtml(g.nomor_wa ?? "–")}</dd>`;
  html += `<dt>Status RSVP</dt><dd>${rsvpBadge(g.rsvp)}</dd>`;
  html += `<dt>Status Check-in</dt><dd>${checkinBadgeText(status)} <span class="mono-time">(${g.checkedIn}/${g.guest_count})</span></dd>`;
  html += `<dt>Waktu Check-in</dt><dd>${g.checkedInAt ? formatTime(g.checkedInAt) : "Belum check-in"}</dd>`;
  html += `<dt>Diedit oleh</dt><dd>${g.edited_status === "rsvp" ? "Tamu (via RSVP)" : g.edited_status === "admin" ? "Admin" : g.edited_status === "couple" ? "Mempelai" : "–"}</dd>`;
  if (g.notes) html += `<dt>Catatan</dt><dd>${escapeHtml(g.notes)}</dd>`;
  if (g.flag)
    html += `<dt>Peringatan</dt><dd style="color:var(--warning)"><i class="bi bi-exclamation-triangle-fill"></i> ${escapeHtml(g.flag)}</dd>`;
  html += "</dl>";

  const bodyEl = document.getElementById("modal-guest-body");
  if (bodyEl) bodyEl.innerHTML = html;

  const cBtn = document.getElementById(
    "modal-checkin-btn",
  ) as HTMLButtonElement | null;
  if (cBtn) {
    cBtn.disabled = status === "sudah" || g.rsvp !== "hadir";
    cBtn.innerHTML =
      status === "sudah"
        ? '<i class="bi bi-check2-circle"></i> Sudah Check-in'
        : '<i class="bi bi-qr-code-scan"></i> Check-in';
  }

  const editBtn = document.getElementById(
    "modal-detail-edit-btn",
  ) as HTMLButtonElement | null;
  if (editBtn) {
    editBtn.onclick = () => {
      hideModal("guest-modal-overlay");
      openEditModal(id);
    };
  }

  showModal("guest-modal-overlay");
}

// --- Modal edit (4.15) ---
function openEditModal(id: string): void {
  const g = guestList.find((x) => x.id === id);
  if (!g) return;
  activeGuestId = id;

  const nm  = document.getElementById("edit-guest-name")     as HTMLInputElement | null;
  const cnt = document.getElementById("edit-guest-count")    as HTMLInputElement | null;
  const kl  = document.getElementById("edit-guest-kelompok")  as HTMLSelectElement | null;
  const kt  = document.getElementById("edit-guest-kategori")  as HTMLSelectElement | null;
  const wa  = document.getElementById("edit-guest-wa")       as HTMLInputElement | null;
  const nts = document.getElementById("edit-guest-notes")    as HTMLTextAreaElement | null;
  const ov  = document.getElementById("edit-modal-overlay")  as HTMLElement | null;
  if (!nm || !cnt || !kl || !kt || !wa || !nts || !ov) return;

  nm.value  = g.name;
  cnt.value = String(g.guest_count);
  kl.value  = g.kelompok || "";
  kt.value  = g.kategori;
  wa.value  = g.nomor_wa || "";
  nts.value = g.notes || "";
  ov.dataset.version = String(g.version);

  showModal("edit-modal-overlay");
}

async function saveEdit(): Promise<void> {
  if (!activeGuestId) return;
  const overlay = document.getElementById("edit-modal-overlay");
  const v = parseInt(overlay?.dataset.version ?? "0", 10);

  const nm  = document.getElementById("edit-guest-name")     as HTMLInputElement | null;
  const cnt = document.getElementById("edit-guest-count")    as HTMLInputElement | null;
  const kl  = document.getElementById("edit-guest-kelompok")  as HTMLSelectElement | null;
  const kt  = document.getElementById("edit-guest-kategori")  as HTMLSelectElement | null;
  const wa  = document.getElementById("edit-guest-wa")       as HTMLInputElement | null;
  const nts = document.getElementById("edit-guest-notes")    as HTMLTextAreaElement | null;
  if (!nm || !cnt || !kl || !kt || !wa || !nts) return;

  const name = nm.value.trim();
  const gc = parseInt(cnt.value, 10);
  const kelompok = kl.value || null;
  const kategori = kt.value as "keluarga" | "bukan";
  const waVal = wa.value.trim() || null;
  const notes = nts.value.trim() || null;

  if (!name || !gc || gc < 1) {
    showToast("Nama dan jumlah tamu wajib diisi", true);
    return;
  }

  // GAP-007: validasi guest_count tidak boleh dikurangi di bawah checked_in
  const g = guestList.find((x) => x.id === activeGuestId);
  if (g && g.checkedIn > gc) {
    showToast(
      `Jumlah tamu tidak boleh kurang dari yang sudah check-in (${g.checkedIn}). Batalkan check-in terlebih dahulu.`,
      true,
    );
    return;
  }

  if (waVal && !isValidWa(waVal)) {
    showToast("Nomor WhatsApp tidak valid. Minimal 10 digit angka.", true);
    return;
  }

  try {
    await updateGuest(activeGuestId, v, {
      name,
      guest_count: gc,
      kelompok,
      kategori,
      nomor_wa: waVal,
      notes,
    });
    hideModal("edit-modal-overlay");
    renderGuestTable();
    populateKelompokFilter();
    flashRow(activeGuestId);
    showToast("Data tamu berhasil diperbarui");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui";
    showToast(
      msg.includes("Data telah berubah")
        ? msg + " — refresh untuk lihat data terbaru."
        : msg,
      true,
    );
  }
}

// --- Check-in dialog (4.16) ---
function openCheckinDialog(id: string): void {
  const g = guestList.find((x) => x.id === id);
  if (!g) return;
  activeGuestId = id;

  (document.getElementById("checkin-dialog-name") as HTMLElement).textContent =
    g.name;

  const rem = g.guest_count - g.checkedIn;
  const isComplete = rem <= 0;

  (
    document.getElementById("checkin-dialog-detail") as HTMLElement
  ).textContent = isComplete
    ? `Sudah check-in: ${g.checkedIn}/${g.guest_count} — semua sudah hadir`
    : `Sudah check-in: ${g.checkedIn}/${g.guest_count} — sisa ${rem}`;

  // Counter display
  const counterEl = document.getElementById("checkin-dialog-counter");
  if (counterEl) {
    counterEl.innerHTML = `<span class="mono-time">${g.checkedIn}</span><span style="color:var(--ink-muted)">/${g.guest_count}</span>`;
  }

  // Detail grid
  const bodyEl = document.getElementById("checkin-dialog-body");
  if (bodyEl) {
    let html = '<dl class="detail-grid">';
    html += `<dt>Kelompok</dt><dd>${escapeHtml(g.kelompok || "–")}</dd>`;
    html += `<dt>Kategori</dt><dd>${g.kategori === "keluarga" ? "Keluarga" : "Bukan Keluarga"}</dd>`;
    html += `<dt>No. WhatsApp</dt><dd>${escapeHtml(g.nomor_wa || "–")}</dd>`;
    html += `<dt>RSVP</dt><dd>${g.rsvp === "hadir" ? "Hadir" : g.rsvp === "tidak" ? "Tidak Hadir" : "Belum Respon"}</dd>`;
    if (g.notes) html += `<dt>Catatan</dt><dd>${escapeHtml(g.notes)}</dd>`;
    html += "</dl>";
    bodyEl.innerHTML = html;
  }

  const allBtn = document.getElementById(
    "checkin-dialog-all",
  ) as HTMLButtonElement;
  allBtn.disabled = isComplete;

  const allLabel = document.getElementById("checkin-dialog-all-label");
  if (allLabel)
    allLabel.textContent = isComplete
      ? "Semua sudah check-in"
      : `Masuk Semua (+${Math.max(1, rem)})`;

  (
    document.getElementById("checkin-dialog-partial-input") as HTMLInputElement
  ).value = String(Math.max(1, rem));
  (
    document.getElementById("checkin-dialog-partial-input") as HTMLInputElement
  ).max = String(Math.max(1, rem));

  const overrideBtn = document.getElementById(
    "checkin-dialog-override-btn",
  ) as HTMLButtonElement | null;
  if (overrideBtn) overrideBtn.disabled = isComplete;

  showModal("checkin-dialog-overlay");
}

async function doCheckinAll(): Promise<void> {
  if (!activeGuestId) return;
  const g = guestList.find((x) => x.id === activeGuestId);
  if (!g) return;
  const rem = g.guest_count - g.checkedIn;
  const delta = rem > 0 ? rem : g.guest_count;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await addCheckin(activeGuestId, user?.id ?? "", delta, "manual", false);
    hideModal("checkin-dialog-overlay");
    renderGuestTable();
    flashRow(activeGuestId);
    showToast(g.name + " berhasil check-in (+" + delta + ")");
    window.dispatchEvent(new CustomEvent("checkin-updated"));
  } catch (err: unknown) {
    showToast(
      "Gagal: " + (err instanceof Error ? err.message : String(err)),
      true,
    );
  }
}

async function doCheckinPartial(): Promise<void> {
  if (!activeGuestId) return;
  const g = guestList.find((x) => x.id === activeGuestId);
  if (!g) return;

  const rem = g.guest_count - g.checkedIn;
  const delta = parseInt(
    (
      document.getElementById(
        "checkin-dialog-partial-input",
      ) as HTMLInputElement
    ).value,
    10,
  );
  if (!delta || delta < 1) {
    showToast("Jumlah tidak valid", true);
    return;
  }

  // Jika delta melebihi remaining, arahkan ke override modal
  if (delta > rem) {
    const warnEl = document.getElementById("override-warning");
    const notesEl = document.getElementById(
      "override-notes",
    ) as HTMLTextAreaElement | null;
    const inputEl = document.getElementById(
      "override-delta",
    ) as HTMLInputElement | null;
    const overrideOverlay = document.getElementById("override-modal-overlay");

    if (warnEl)
      warnEl.textContent = `Check-in sebanyak ${delta} melebihi kuota tersisa (${rem}/${g.guest_count}). Masukkan jumlah tambahan dan alasan override.`;
    if (notesEl) notesEl.value = "";
    if (inputEl) {
      inputEl.value = String(delta);
      inputEl.min = "1";
    }
    if (overrideOverlay) {
      overrideOverlay.dataset.reservationId = activeGuestId;
      overrideOverlay.dataset.source = "checkin-dialog";
    }

    showModal("override-modal-overlay");
    return;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await addCheckin(activeGuestId, user?.id ?? "", delta, "manual", false);
    hideModal("checkin-dialog-overlay");
    renderGuestTable();
    flashRow(activeGuestId);
    showToast(g.name + " check-in (+" + delta + ")");
    window.dispatchEvent(new CustomEvent("checkin-updated"));
  } catch (err: unknown) {
    showToast(
      "Gagal: " + (err instanceof Error ? err.message : String(err)),
      true,
    );
  }
}

function openManualOverride(): void {
  if (!activeGuestId) return;
  const g = guestList.find((x) => x.id === activeGuestId);
  if (!g) return;

  const warnEl = document.getElementById("override-warning");
  const notesEl = document.getElementById(
    "override-notes",
  ) as HTMLTextAreaElement | null;
  const inputEl = document.getElementById(
    "override-delta",
  ) as HTMLInputElement | null;
  const overrideOverlay = document.getElementById("override-modal-overlay");

  if (warnEl)
    warnEl.textContent = `Check-in melebihi kuota (${g.checkedIn}/${g.guest_count}). Masukkan jumlah tambahan dan alasan override.`;
  if (notesEl) notesEl.value = "";
  if (inputEl) {
    inputEl.value = "1";
    inputEl.min = "1";
  }
  if (overrideOverlay) {
    overrideOverlay.dataset.reservationId = activeGuestId;
    overrideOverlay.dataset.source = "checkin-dialog";
  }

  showModal("override-modal-overlay");
}

async function doManualOverrideConfirm(): Promise<void> {
  const overrideOverlay = document.getElementById("override-modal-overlay");
  const resId = overrideOverlay?.dataset.reservationId;
  if (!resId) return;

  const delta = parseInt(
    (document.getElementById("override-delta") as HTMLInputElement)?.value ??
      "0",
    10,
  );
  const notes = (
    document.getElementById("override-notes") as HTMLTextAreaElement
  )?.value.trim();

  if (!delta || delta < 1) {
    showToast("Jumlah tidak valid", true);
    return;
  }
  if (!notes) {
    showToast("Alasan override wajib diisi", true);
    return;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await addCheckin(resId, user?.id ?? "", delta, "manual", true);
    hideModal("override-modal-overlay");

    const g = guestList.find((x) => x.id === resId);
    if (g) {
      showToast(g.name + " override (+" + delta + ") berhasil");
    }

    renderGuestTable();
    window.dispatchEvent(new CustomEvent("checkin-updated"));

    // Jika override dari checkin dialog, refresh dialog
    if (overrideOverlay?.dataset.source === "checkin-dialog") {
      activeGuestId = resId;
      openCheckinDialog(resId);
    }
  } catch (err: unknown) {
    showToast(
      "Gagal: " + (err instanceof Error ? err.message : String(err)),
      true,
    );
  }
}

// --- Add guest (4.13) ---
function openAddGuestModal(): void {
  const nm  = document.getElementById("add-guest-name")     as HTMLInputElement | null;
  const cnt = document.getElementById("add-guest-count")    as HTMLInputElement | null;
  const kl  = document.getElementById("add-guest-kelompok")  as HTMLSelectElement | null;
  const kt  = document.getElementById("add-guest-kategori")  as HTMLSelectElement | null;
  const wa  = document.getElementById("add-guest-wa")       as HTMLInputElement | null;
  const nts = document.getElementById("add-guest-notes")    as HTMLTextAreaElement | null;
  if (!nm || !cnt || !kl || !kt || !wa || !nts) return;
  nm.value  = "";
  cnt.value = "1";
  kl.value  = "";
  kt.value  = "bukan";
  wa.value  = "";
  nts.value = "";
  showModal("add-modal-overlay");
}

async function saveNewGuest(): Promise<void> {
  const nm  = document.getElementById("add-guest-name")     as HTMLInputElement | null;
  const cnt = document.getElementById("add-guest-count")    as HTMLInputElement | null;
  const kl  = document.getElementById("add-guest-kelompok")  as HTMLSelectElement | null;
  const kt  = document.getElementById("add-guest-kategori")  as HTMLSelectElement | null;
  const wa  = document.getElementById("add-guest-wa")       as HTMLInputElement | null;
  const nts = document.getElementById("add-guest-notes")    as HTMLTextAreaElement | null;
  if (!nm || !cnt || !kl || !kt || !wa || !nts) return;

  const name = nm.value.trim();
  const gc = parseInt(cnt.value, 10);
  const kelompok = kl.value || null;
  const kategori = kt.value as "keluarga" | "bukan";
  const waVal = wa.value.trim() || null;
  const notes = nts.value.trim() || null;

  if (!name || !gc || gc < 1) {
    showToast("Nama dan jumlah tamu wajib diisi", true);
    return;
  }

  if (waVal && !isValidWa(waVal)) {
    showToast("Nomor WhatsApp tidak valid. Minimal 10 digit angka.", true);
    return;
  }

  try {
    const g = await insertGuest({
      name,
      guest_count: gc,
      kelompok,
      kategori,
      nomor_wa: waVal,
      notes,
    });
    hideModal("add-modal-overlay");
    populateKelompokFilter();
    renderGuestTable();
    flashRow(g.id);
    showToast("Tamu berhasil ditambahkan: " + g.name);
  } catch (err: unknown) {
    showToast(
      "Gagal: " + (err instanceof Error ? err.message : String(err)),
      true,
    );
  }
}

// --- Group picker ---
let activeKelompokGuestId: string | null = null;

function openGroupPicker(chip: HTMLElement): void {
  activeKelompokGuestId = chip.closest("tr")?.dataset.id ?? null;
  const picker = document.getElementById("group-picker");
  if (!picker) return;
  const rect = chip.getBoundingClientRect();
  const pickerWidth = 240;
  picker.style.top = window.scrollY + rect.bottom + 6 + "px";
  const left = rect.left + pickerWidth > window.innerWidth
    ? Math.max(8, window.innerWidth - pickerWidth - 8)
    : Math.max(8, rect.left);
  picker.style.left = window.scrollX + left + "px";
  picker.style.maxWidth = Math.min(pickerWidth, window.innerWidth - 16) + "px";

  const groups = [...new Set(guestList.map((g) => g.kelompok).filter(Boolean))];
  const list = document.getElementById("group-picker-list");
  if (list) {
    list.innerHTML = groups
      .map(
        (n) =>
          `<button type="button" class="group-picker__item" data-group="${escapeAttr(n!)}"><span class="group-picker__dot"></span>${escapeHtml(n!)}</button>`,
      )
      .join("");
  }
  picker.classList.add("show");
  document.getElementById("group-new-input")?.focus();
}

function closeGroupPicker(): void {
  document.getElementById("group-picker")?.classList.remove("show");
  activeKelompokGuestId = null;
}

// --- Audit log (4.18) ---
async function renderAuditLog(): Promise<void> {
  const el = document.getElementById("audit-log-list");
  if (!el) return;
  el.innerHTML =
    '<div class="skeleton-row"><div class="skeleton-bar"></div><div class="skeleton-bar"></div></div>';

  try {
    const entries = await fetchCheckinLog();
    if (!entries.length) {
      el.innerHTML =
        '<p style="color:var(--ink-muted);font-size:0.8125rem;text-align:center">Belum ada aktivitas check-in.</p>';
      return;
    }
    el.innerHTML = entries
      .map(
        (e: CheckinLogEntry) => `
      <div class="scan-result-item${e.isOverride ? " is-invalid" : ""}">
        <div class="scan-result-item__icon"><i class="bi bi-${e.isOverride ? "shield-exclamation" : "clock-history"}"></i></div>
        <div style="flex:1">
          <div class="scan-result-item__name">${escapeHtml(e.guestName)} ${e.isOverride ? '<span class="badge-dash badge-dash--danger ms-1">Override</span>' : ""}</div>
          <div class="scan-result-item__meta">+${e.delta} tamu via ${e.method === "qr" ? "QR" : "manual"}${e.notes ? " · " + escapeHtml(e.notes) : ""} · oleh ${escapeHtml(e.adminName)} · ${formatTime(e.createdAt)}</div>
        </div>
        ${e.delta > 0 ? `<button type="button" class="btn btn-sm btn-outline-danger ms-2 undo-checkin-btn" data-reservation-id="${e.reservationId}" data-delta="${e.delta}" title="Undo check-in"><i class="bi bi-arrow-counterclockwise"></i></button>` : ""}
      </div>`,
      )
      .join("");
  } catch {
    el.innerHTML =
      '<p style="color:var(--danger);font-size:0.8125rem;text-align:center">Gagal memuat audit log.</p>';
  }
}

// --- Init (4.4: skeleton + fetch) ---
export async function initGuestTable(): Promise<void> {
  const skel = document.getElementById("guest-skeleton");
  hide(document.getElementById("guest-table-wrap"));
  hide(document.getElementById("guest-empty"));
  hide(document.getElementById("guest-empty-first"));
  hide(document.getElementById("guest-error"));
  show(skel);

  try {
    await fetchGuests();
  } catch {
    hide(skel);
    show(document.getElementById("guest-error"));
    return;
  }

  hide(skel);
  populateKelompokFilter();
  renderGuestTable();

  setupRealtime((guest) => {
    renderGuestTable();
    renderNotifications();
    flashRow(guest.id);
  });
}

// --- Reload (4.10) ---
export async function reloadGuests(): Promise<void> {
  const btn = document.getElementById(
    "btn-reload-guests",
  ) as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  const skel = document.getElementById("guest-skeleton");
  hide(document.getElementById("guest-table-wrap"));
  hide(document.getElementById("guest-empty"));
  hide(document.getElementById("guest-empty-first"));
  hide(document.getElementById("guest-error"));
  show(skel);

  // Snapshot anomali sebelum reload
  const prevSnapshot = getAnomalySnapshot();

  try {
    await fetchGuests();
    hide(skel);
    populateKelompokFilter();
    renderGuestTable();

    // Notifikasi hanya jika ada perubahan anomali
    if (getAnomalySnapshot() !== prevSnapshot) {
      renderNotifications();
    }
  } catch {
    hide(skel);
    show(document.getElementById("guest-error"));
  }

  if (btn) btn.disabled = false;
}

// --- Export / Import (GAP-016) ---

function exportGuests(): void {
  const header = ["Name", "Guest Count", "Category", "Group", "Phone", "Notes"];
  const rows = guestList.map((g) => [
    g.name,
    String(g.guest_count),
    g.kategori,
    g.kelompok ?? "",
    g.nomor_wa ?? "",
    g.notes ?? "",
  ]);
  const bom = "﻿"; // BOM UTF-8 agar Excel mengenali encoding
  const csv = bom + [header, ...rows]
    .map((cols) => cols.map((c) => '"' + c.replace(/"/g, '""') + '"').join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "daftar-tamu.csv";
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${guestList.length} tamu diekspor ke CSV`);
}

// --- Event bindings ---
export function initGuestEvents(): void {
  // Sort headers (4.8)
  document
    .querySelectorAll<HTMLElement>(".guest-table th.is-sortable")
    .forEach((th) => {
      const apply = () => {
        const k = th.dataset.sort;
        if (k) setSortKey(k);
        renderGuestTable();
      };
      th.addEventListener("click", apply);
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          apply();
        }
      });
    });

  // Search debounce (4.6)
  const si = document.getElementById("guest-search") as HTMLInputElement | null;
  const debouncedRender = debounce(() => renderGuestTable(), 250);
  si?.addEventListener("input", function () {
    setSearchQuery(this.value.trim());
    document
      .getElementById("search-box")
      ?.classList.toggle("has-value", !!searchQuery);
    debouncedRender();
  });

  document.getElementById("search-clear")?.addEventListener("click", () => {
    if (si) si.value = "";
    setSearchQuery("");
    document.getElementById("search-box")?.classList.remove("has-value");
    renderGuestTable();
    si?.focus();
  });

  // Filter dropdowns (4.7)
  ["checkin", "rsvp", "kategori", "kelompok"].forEach((k) => {
    document
      .getElementById("filter-" + k)
      ?.addEventListener("change", function (this: HTMLSelectElement) {
        filters[k] = this.value;
        setCurrentPage(0);
        renderGuestTable();
      });
  });

  // Mobile filter drawer (4.7)
  document
    .getElementById("filter-drawer-toggle")
    ?.addEventListener("click", () => {
      document.getElementById("filter-group")?.classList.toggle("drawer-open");
    });

  // Page size (4.9)
  document
    .getElementById("page-size-select")
    ?.addEventListener("change", function (this: HTMLSelectElement) {
      setPageSize(parseInt(this.value, 10));
      renderGuestTable();
    });

  // Reset filter
  document
    .getElementById("guest-empty-reset")
    ?.addEventListener("click", () => {
      resetFilters();
      renderGuestTable();
    });

  // Error retry (4.5)
  document
    .getElementById("guest-error-retry")
    ?.addEventListener("click", () => {
      initGuestTable();
    });

  // Empty first CTA (4.5)
  document
    .getElementById("guest-empty-first-cta")
    ?.addEventListener("click", () => {
      openAddGuestModal();
    });

  // Reload (4.10)
  document
    .getElementById("btn-reload-guests")
    ?.addEventListener("click", () => {
      reloadGuests();
    });

  // Add guest (4.13)
  document.getElementById("btn-add-guest")?.addEventListener("click", () => {
    openAddGuestModal();
  });
  document
    .getElementById("add-guest-save-btn")
    ?.addEventListener("click", () => {
      saveNewGuest();
    });

  // Export / Import (GAP-016)
  document.getElementById("btn-export-guests")?.addEventListener("click", () => {
    exportGuests();
  });
  document.getElementById("btn-import-guests")?.addEventListener("click", () => {
    // Delegasi ke ImportModal (di-init oleh dashboard.ts)
    import("./import-modal").then((m) => m.importModal?.open());
  });

  // Edit guest save (4.15)
  document
    .getElementById("edit-guest-save-btn")
    ?.addEventListener("click", () => {
      saveEdit();
    });

  // Check-in dialog buttons (4.16)
  document
    .getElementById("checkin-dialog-all")
    ?.addEventListener("click", () => doCheckinAll());
  document
    .getElementById("checkin-dialog-partial-btn")
    ?.addEventListener("click", () => doCheckinPartial());
  document
    .getElementById("checkin-dialog-override-btn")
    ?.addEventListener("click", () => openManualOverride());
  document
    .getElementById("checkin-dialog-close")
    ?.addEventListener("click", () => {
      hideModal("checkin-dialog-overlay");
    });

  // Table event delegation
  document
    .getElementById("guest-tbody")
    ?.addEventListener("click", function (e) {
      const t = e.target as HTMLElement;
      const d = t.closest<HTMLElement>('[data-action="detail"]');
      const ed = t.closest<HTMLElement>('[data-action="edit"]');
      const c = t.closest<HTMLElement>('[data-action="checkin"]');
      const wa = t.closest<HTMLElement>('[data-action="wa"]');
      const dl = t.closest<HTMLElement>('[data-action="download"]');
      const ch = t.closest<HTMLElement>("[data-kelompok]");

      if (d) openGuestModal(d.dataset.id!);
      else if (ed) openEditModal(ed.dataset.id!);
      else if (c && !c.classList.contains("is-disabled"))
        openCheckinDialog(c.dataset.id!);
      else if (wa && !wa.hasAttribute("disabled")) {
        const g = guestList.find((x) => x.id === wa.dataset.id);
        if (g?.nomor_wa) window.open(buildWaUrl(g.slug, g.nomor_wa), "_blank");
      }
      else if (dl) openDownloadModal([dl.dataset.id!]);
      else if (ch) openGroupPicker(ch);
    });

  // Select-all (4.11)
  document
    .getElementById("select-all-guests")
    ?.addEventListener("change", function (this: HTMLInputElement) {
      const pageItems = getPageItems();
      if (this.checked) pageItems.forEach((g) => selectedIds.add(g.id));
      else pageItems.forEach((g) => selectedIds.delete(g.id));
      updateBulkBar();
      renderGuestTable();
    });

  // Row checkbox (4.11)
  document
    .getElementById("guest-tbody")
    ?.addEventListener("change", function (e) {
      const cb = (e.target as HTMLElement).closest<HTMLInputElement>(
        ".row-check",
      );
      if (!cb) return;
      const id = cb.dataset.select!;
      if (cb.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      cb.closest("tr")?.classList.toggle("is-selected", cb.checked);
      updateBulkBar();
      updateSelectAll();
    });

  // Bulk actions (4.12)
  document.getElementById("bulk-del")?.addEventListener("click", async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Hapus ${selectedIds.size} tamu terpilih? Tindakan ini tidak dapat dibatalkan.`,
      )
    )
      return;
    const btn = document.getElementById("bulk-del") as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    try {
      await deleteGuests([...selectedIds]);
      showToast(selectedIds.size + " tamu berhasil dihapus");
      selectedIds.clear();
      updateBulkBar();
      populateKelompokFilter();
      renderGuestTable();
    } catch (err: unknown) {
      showToast(
        "Gagal menghapus: " +
          (err instanceof Error ? err.message : String(err)),
        true,
      );
    } finally {
      if (btn) btn.disabled = false;
    }
  });
document.getElementById("bulk-clear")?.addEventListener("click", () => {
    selectedIds.clear();
    updateBulkBar();
    renderGuestTable();
  });

  // Bulk WhatsApp blast
  document.getElementById("bulk-wa")?.addEventListener("click", () => {
    if (selectedIds.size === 0) return;
    openWaBlastModal([...selectedIds]);
  });

  // Bulk download cards
  document.getElementById("bulk-download")?.addEventListener("click", () => {
    if (selectedIds.size === 0) return;
    openDownloadModal([...selectedIds]);
  });

  // WA blast events
  document.getElementById("wa-blast-send-btn")?.addEventListener("click", () => sendNextWa());
  document.getElementById("wa-blast-close-modal-btn")?.addEventListener("click", () => hideModal("wa-blast-overlay"));

  // Download card events
  document.getElementById("download-card-download-btn")?.addEventListener("click", () => {
    const landscapeRadio = document.getElementById("download-card-format-landscape") as HTMLInputElement | null;
    const format: "landscape" | "portrait" = landscapeRadio?.checked ? "landscape" : "portrait";
    downloadCards(downloadCardIds, format);
  });
  document.getElementById("download-card-close-modal-btn")?.addEventListener("click", () => hideModal("download-card-overlay"));

  // Detail modal check-in button
  document
    .getElementById("modal-checkin-btn")
    ?.addEventListener("click", () => {
      if (activeGuestId) {
        hideModal("guest-modal-overlay");
        openCheckinDialog(activeGuestId);
      }
    });

  // Group picker
  document
    .getElementById("group-picker-list")
    ?.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>(
        ".group-picker__item",
      );
      if (!item || !activeKelompokGuestId) return;
      const g = guestList.find((x) => x.id === activeKelompokGuestId);
      if (!g) {
        showToast("Data tamu tidak ditemukan", true);
        return;
      }
      const current = guestList.find((x) => x.id === activeKelompokGuestId);
      if (!current) {
        showToast("Data tamu tidak ditemukan", true);
        return;
      }
      updateGuest(activeKelompokGuestId, current.version, {
        kelompok: item.dataset.group ?? null,
      })
          .then(() => {
            closeGroupPicker();
            populateKelompokFilter();
            renderGuestTable();
            showToast("Kelompok diperbarui");
          })
          .catch(() => showToast("Gagal mengubah kelompok", true));
    });

  document.getElementById("group-add-btn")?.addEventListener("click", () => {
    const inp = document.getElementById(
      "group-new-input",
    ) as HTMLInputElement | null;
    const val = inp?.value.trim();
    if (!val || !activeKelompokGuestId) return;

    const current = guestList.find((x) => x.id === activeKelompokGuestId);
    if (!current) {
      showToast("Data tamu tidak ditemukan", true);
      return;
    }
    updateGuest(activeKelompokGuestId, current.version, { kelompok: val })
        .then(() => {
          if (inp) inp.value = "";
          closeGroupPicker();
          populateKelompokFilter();
          renderGuestTable();
          showToast("Kelompok baru dibuat");
        })
        .catch(() => showToast("Gagal membuat kelompok", true));
  });

  document.addEventListener("click", (e) => {
    const picker = document.getElementById("group-picker");
    if (
      picker?.classList.contains("show") &&
      !picker.contains(e.target as Node) &&
      !(e.target as HTMLElement).closest("[data-kelompok]")
    ) {
      closeGroupPicker();
    }
  });

  // Preview links
  document.getElementById("preview-empty")?.addEventListener("click", (e) => {
    e.preventDefault();
    hide(document.getElementById("guest-table-wrap"));
    show(document.getElementById("guest-empty-first"));
  });
  document.getElementById("preview-error")?.addEventListener("click", (e) => {
    e.preventDefault();
    hide(document.getElementById("guest-table-wrap"));
    hide(document.getElementById("guest-empty-first"));
    hide(document.getElementById("guest-empty"));
    show(document.getElementById("guest-error"));
  });
  document.getElementById("preview-reset")?.addEventListener("click", (e) => {
    e.preventDefault();
    renderGuestTable();
  });

  // Audit log on page change
  window.addEventListener("page-changed", ((e: CustomEvent) => {
    if (e.detail.page === "checkin") renderAuditLog();
  }) as EventListener);

  // GAP-011: Undo check-in buttons di audit log
  document
    .getElementById("audit-log-list")
    ?.addEventListener("click", async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        ".undo-checkin-btn",
      );
      if (!btn) return;
      const reservationId = btn.dataset.reservationId!;
      const delta = parseInt(btn.dataset.delta ?? "0", 10);
      if (!confirm(`Undo check-in (+${delta})? Data check-in akan dikurangi.`))
        return;
      try {
        btn.disabled = true;
        await undoCheckin(reservationId, delta);
        await fetchGuests();
        renderGuestTable();
        await renderAuditLog();
        showToast("Check-in berhasil di-undo (-" + delta + ")");
      } catch (err: unknown) {
        showToast(
          "Gagal undo: " + (err instanceof Error ? err.message : String(err)),
          true,
        );
      } finally {
        btn.disabled = false;
      }
    });

  // Cross-module events from checkin.ts (5.2, 5.7)
  window.addEventListener("open-checkin-dialog", ((e: CustomEvent) => {
    if (e.detail?.id) openCheckinDialog(e.detail.id);
  }) as EventListener);

  window.addEventListener("open-edit-guest", ((e: CustomEvent) => {
    if (e.detail?.id) openEditModal(e.detail.id);
  }) as EventListener);
}

// --- WhatsApp Blast ---

const BASE_URL = config.SITE_URL || window.location.origin;

function waMessage(slug: string): string {
  return `Assalamu'alaikum,\n\nKami mengundang Anda ke acara pernikahan Reza & Ashila.\n\nSilakan buka undangan digital Anda di sini:\n${BASE_URL}/invitation/${slug}\n\nTerima kasih 🤍`;
}

// Hanya menyisakan digit — nomor WA bisa datang dengan spasi, tanda hubung, atau awalan +
function cleanPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function buildWaUrl(slug: string, nomorWa: string): string {
  const phone = cleanPhone(nomorWa);
  return `https://wa.me/${phone}?text=${encodeURIComponent(waMessage(slug))}`;
}

// --- Modal lifecycle ---

function resetBlastUI(total: number): void {
  const countEl = document.getElementById("wa-blast-count");
  if (countEl) countEl.textContent = String(total);

  hide(document.getElementById("wa-blast-progress"));
  hide(document.getElementById("wa-blast-summary"));

  const sendBtn = document.getElementById("wa-blast-send-btn") as HTMLButtonElement | null;
  if (sendBtn) {
    sendBtn.disabled = total === 0;
    sendBtn.innerHTML = '<i class="bi bi-whatsapp"></i> Kirim';
  }
}

function updateSendButton(index: number, total: number): void {
  const sendBtn = document.getElementById("wa-blast-send-btn") as HTMLButtonElement | null;
  if (sendBtn) {
    sendBtn.innerHTML = `<i class="bi bi-whatsapp"></i> Kirim (${index + 1}/${total})`;
  }
}

function updateBlastProgress(index: number, total: number, guestName: string): void {
  const progressFill = document.getElementById("wa-blast-progress-fill");
  const statusEl = document.getElementById("wa-blast-status");
  const sentEl = document.getElementById("wa-blast-sent");

  const pct = Math.round(((index + 1) / total) * 100);
  if (progressFill) progressFill.style.width = pct + "%";
  if (statusEl) statusEl.textContent = `${index + 1}/${total} — ${escapeHtml(guestName)}`;
  if (sentEl) sentEl.textContent = String(index + 1);
}

function showBlastComplete(sent: number, errors: number): void {
  const sendBtn = document.getElementById("wa-blast-send-btn") as HTMLButtonElement | null;
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="bi bi-check-circle"></i> Selesai';
  }

  hide(document.getElementById("wa-blast-progress"));

  const summaryEl = document.getElementById("wa-blast-summary");
  show(summaryEl);

  const sentEl = document.getElementById("wa-blast-sent");
  const errEl = document.getElementById("wa-blast-errors");
  if (sentEl) sentEl.textContent = String(sent);
  if (errEl) errEl.textContent = String(errors);
}

// --- Entry points ---

function openWaBlastModal(ids: string[]): void {
  const totalSelected = ids.length;
  waBlastTargetIds = ids.filter((id) => {
    const g = guestList.find((x) => x.id === id);
    return g?.nomor_wa && cleanPhone(g.nomor_wa).length > 0;
  });

  const skipped = totalSelected - waBlastTargetIds.length;
  const skipWarning = document.getElementById("wa-blast-skip-warning");
  if (skipWarning) {
    if (skipped > 0) {
      skipWarning.style.display = "";
      const countEl = document.getElementById("wa-blast-skip-count");
      if (countEl) countEl.textContent = String(skipped);
    } else {
      skipWarning.style.display = "none";
    }
  }

  waBlastIndex = 0;
  waBlastSent = 0;
  waBlastErrors = 0;

  const total = waBlastTargetIds.length;
  resetBlastUI(total);
  if (total > 0) updateSendButton(0, total);
  showModal("wa-blast-overlay");
}

/** Kirim undangan ke tamu berikutnya — sinkron agar tidak diblokir popup blocker */
function sendNextWa(): void {
  if (waBlastIndex >= waBlastTargetIds.length) return;

  const id = waBlastTargetIds[waBlastIndex];
  const g = guestList.find((x) => x.id === id);
  if (!g) {
    waBlastErrors++;
    waBlastIndex++;
    if (waBlastIndex < waBlastTargetIds.length) {
      updateSendButton(waBlastIndex, waBlastTargetIds.length);
    }
    return;
  }

  // Progress bar dan summary muncul setelah klik pertama
  if (waBlastIndex === 0) {
    show(document.getElementById("wa-blast-progress"));
  }

  const phone = cleanPhone(g.nomor_wa ?? "");
  updateBlastProgress(waBlastIndex, waBlastTargetIds.length, g.name);

  // window.open dipanggil SINKRON dalam user gesture — tidak akan diblokir
  const waTab = window.open(buildWaUrl(g.slug, phone), "_blank");
  if (!waTab) {
    waBlastErrors++;
    const statusEl = document.getElementById("wa-blast-status");
    if (statusEl) statusEl.textContent = `${waBlastIndex + 1}/${waBlastTargetIds.length} — popup diblokir, izinkan popup untuk situs ini`;
  } else {
    waBlastSent++;
  }

  waBlastIndex++;

  if (waBlastIndex >= waBlastTargetIds.length) {
    // Semua sudah dikirim
    showBlastComplete(waBlastSent, waBlastErrors);
  } else {
    updateSendButton(waBlastIndex, waBlastTargetIds.length);
  }
}

// --- Download card state ---
let downloadCardIds: string[] = [];

// --- Download card functions ---

/** Buka modal unduh kartu — mirror openWaBlastModal */
function openDownloadModal(ids: string[]): void {
  // Filter tamu yang punya slug (card memerlukan slug untuk identitas)
  downloadCardIds = ids.filter((id) => {
    const g = guestList.find((x) => x.id === id);
    return g?.slug;
  });

  const listEl = document.getElementById("download-card-guest-list");
  if (listEl) {
    const names = downloadCardIds.map((id) => {
      const g = guestList.find((x) => x.id === id);
      return g?.name ?? "Tamu";
    });
    if (names.length <= 2) {
      listEl.textContent = names.join(", ");
    } else {
      listEl.textContent = `${names[0]}, ${names[1]}, dan ${names.length - 2} tamu lainnya`;
    }
  }

  // Reset radio ke landscape
  const landscapeRadio = document.getElementById("download-card-format-landscape") as HTMLInputElement | null;
  const portraitRadio = document.getElementById("download-card-format-portrait") as HTMLInputElement | null;
  if (landscapeRadio) landscapeRadio.checked = true;
  if (portraitRadio) portraitRadio.checked = false;

  // Hide progress & errors
  const progressEl = document.getElementById("download-card-progress");
  const errorsEl = document.getElementById("download-card-errors");
  if (progressEl) progressEl.classList.add("d-none-important");
  if (errorsEl) errorsEl.classList.add("d-none-important");

  // Enable download button
  const downloadBtn = document.getElementById("download-card-download-btn") as HTMLButtonElement | null;
  if (downloadBtn) downloadBtn.disabled = false;

  showModal("download-card-overlay");
}

/** Mirror buildCardHTML() dari card-page.ts — tanpa toolbar dan tombol download */
function buildCardHTML(
  guest: { id: string; name: string },
  qrToken: string | null,
  format: "landscape" | "portrait",
): string {
  const data = {
    nama: guest.name,
    tanggal: "Sabtu, 22 Agustus 2026",
    lokasi: "RIVEA Riverside Cafe and Space, Ngaglik, Sleman, DIY",
    dressCode: "Formal / semi-formal",
  };

  const qrId = `card-qr-${guest.id}`;

  return `
    <section class="invitation-card ${format}" aria-label="Kartu undangan pernikahan Reza dan Ashila">
      <div class="card-header-section">
        <p class="card-label">Kartu Undangan Pernikahan</p>
        <h1 class="card-couple-name">Reza &amp; Ashila</h1>
      </div>
      <img src="/assets/img/ornamen.svg" alt="ornament" class="ornament ornament-top">
      <img src="/assets/img/ornamen.svg" alt="ornament" class="ornament ornament-bottom">
      <div class="card-body-row">
        <div class="card-body-info">
          <div class="card-guest-highlight">
            <p class="card-info-label">Kepada Yth.</p>
            <p class="card-info-value card-info-value--guest-name">${escapeHtml(data.nama)}</p>
          </div>
          <dl class="card-info-list">
            <div class="card-info-row">
              <dt class="card-info-label">Tanggal</dt>
              <dd class="card-info-value">${escapeHtml(data.tanggal)}</dd>
            </div>
            <div class="card-info-row">
              <dt class="card-info-label">Lokasi</dt>
              <dd class="card-info-value">${escapeHtml(data.lokasi)}</dd>
            </div>
            <div class="card-info-row">
              <dt class="card-info-label">Dress code</dt>
              <dd class="card-info-value">${escapeHtml(data.dressCode)}</dd>
            </div>
          </dl>
        </div>
        <div class="card-body-qr">
          <div class="card-qr card-qr--loading" id="${qrId}" role="img" aria-label="Memuat kode QR untuk ${escapeAttr(guest.name)}"></div>
        </div>
      </div>
      <div class="card-footer-section">
        <p class="card-instruction">Simpan kartu ini dan tunjukkan saat hari acara</p>
      </div>
    </section>
  `;
}

/** Capture card element to canvas — mirror card-page.ts handleDownload */
function captureCard(element: HTMLElement): Promise<HTMLCanvasElement> {
  const scale = window.devicePixelRatio > 1 ? 2 : 1;
  return html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDoc: Document) => {
      const clonedCard = clonedDoc.querySelector(".invitation-card") as HTMLElement | null;
      if (clonedCard) {
        clonedCard.style.transition = "none";
        clonedCard.style.transform = "none";
      }
    },
  });
}

/** Wrap canvas.toBlob in Promise */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

/** Download single PNG blob via anchor click */
function downloadSingleCard(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/** Fetch qr_token dari tabel reservations untuk satu tamu */
async function fetchTokenForGuest(guestId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("reservations")
    .select("qr_token")
    .eq("id", guestId)
    .single();
  if (error || !data?.qr_token) return null;
  return data.qr_token as string;
}

/** Orchestrator: render, capture, dan download kartu untuk satu atau banyak tamu */
async function downloadCards(ids: string[], format: "landscape" | "portrait"): Promise<void> {
  const container = document.getElementById("card-render-container");
  const downloadBtn = document.getElementById("download-card-download-btn") as HTMLButtonElement | null;
  const progressBar = document.getElementById("download-card-progress");
  const progressFill = document.getElementById("download-card-progress-fill") as HTMLElement | null;
  const progressStatus = document.getElementById("download-card-progress-status");
  const errorsEl = document.getElementById("download-card-errors");

  if (!container) return;

  try {
    // 1. Fetch token untuk semua tamu
    const tokenResults = await Promise.allSettled(ids.map((id) => fetchTokenForGuest(id)));

    // 2. Build array valid guests: punya slug dan qr_token
    interface ValidGuest {
      id: string;
      name: string;
      slug: string;
      qrToken: string;
    }

    const valid: ValidGuest[] = [];
    let skipped = 0;

    for (let i = 0; i < ids.length; i++) {
      const result = tokenResults[i];
      const token = result.status === "fulfilled" ? result.value : null;
      const g = guestList.find((x) => x.id === ids[i]);

      if (!g?.slug || !token) {
        skipped++;
        continue;
      }
      valid.push({ id: g.id, name: g.name, slug: g.slug, qrToken: token });
    }

    // 3. Jika semua tidak valid
    if (valid.length === 0) {
      if (errorsEl) {
        errorsEl.classList.remove("d-none-important");
        errorsEl.textContent = "Semua tamu dipilih tidak valid — tidak memiliki slug atau token QR.";
      }
      if (downloadBtn) downloadBtn.disabled = true;
      return;
    }

    // 4. Set loading state
    if (downloadBtn) downloadBtn.disabled = true;
    if (progressBar) progressBar.classList.remove("d-none-important");
    if (errorsEl) errorsEl.classList.add("d-none-important");

    const blobs: { blob: Blob; slug: string }[] = [];
    const total = valid.length;
    let completed = 0;

    // Reset container
    container.innerHTML = "";

    // 5. Proses dalam batch 4 concurrent
    const CONCURRENCY = 4;

    for (let batch = 0; batch < valid.length; batch += CONCURRENCY) {
      const batchSlice = valid.slice(batch, batch + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batchSlice.map(async (v): Promise<{ blob: Blob; slug: string }> => {
          // Render HTML
          const cardHTML = buildCardHTML(
            { id: v.id, name: v.name },
            v.qrToken,
            format,
          );

          // Set HTML di container
          container.innerHTML = cardHTML;

          // Generate QR code (await sebelum capture untuk hindari race condition)
          const qrEl = document.getElementById(`card-qr-${v.id}`);
          if (qrEl && v.qrToken) {
            const qrCanvas = document.createElement("canvas");
            await new Promise<void>((resolveQr, rejectQr) => {
              QRCode.toCanvas(qrCanvas, v.qrToken, {
                width: 300,
                margin: 2,
                color: { dark: "#0a0a0a", light: "#ffffff" },
                errorCorrectionLevel: "H",
              }, (err: Error | null | undefined) => {
                if (err) rejectQr(err);
                else {
                  qrEl.classList.remove("card-qr--loading");
                  qrEl.appendChild(qrCanvas);
                  resolveQr();
                }
              });
            });
          }

          // Capture
          const card = container.querySelector(".invitation-card") as HTMLElement | null;
          if (!card) throw new Error("Card element not found");
          card.classList.add("exporting");
          const canvas = await captureCard(card);
          const blob = await canvasToBlob(canvas);
          return { blob, slug: v.slug };
        }),
      );

      // Track results
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        completed++;
        if (r.status === "fulfilled") {
          blobs.push(r.value);
        } else {
          skipped++;
        }

        // Update progress
        const pct = Math.round((completed / total) * 100);
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressStatus) progressStatus.textContent = `${completed}/${total} kartu selesai`;
      }
    }

    // 6. Download hasil
    if (blobs.length === 1) {
      const fileName = `kartu-undangan-${blobs[0].slug}.png`;
      downloadSingleCard(blobs[0].blob, fileName);
    } else if (blobs.length > 1) {
      const zip = new JSZip();
      for (const { blob, slug } of blobs) {
        zip.file(`kartu-undangan-${slug}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.download = "kartu-undangan.zip";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }

    showToast(
      `${blobs.length} kartu undangan berhasil diunduh.` +
        (skipped > 0 ? ` ${skipped} tamu dilewati.` : ""),
      skipped > 0,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat mengunduh kartu.";
    showToast(message, true);
  } finally {
    // 7. Cleanup — always runs
    if (progressBar) progressBar.classList.add("d-none-important");
    if (downloadBtn) downloadBtn.disabled = false;
    container.innerHTML = "";
    hideModal("download-card-overlay");
  }
}

