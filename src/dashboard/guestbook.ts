// src/dashboard/guestbook.ts
import { state } from './state';
import { escapeHtml, formatDate, showToast } from './utils';

interface GuestbookEntry {
  id: string;
  nama: string;
  pesan: string;
  is_approved: boolean;
  created_at: string;
}

export async function loadGuestbook(): Promise<void> {
  const statusEl = document.getElementById("gb-status");
  const emptyEl = document.getElementById("gb-empty");
  if (statusEl) statusEl.classList.remove("show");
  if (emptyEl) emptyEl.classList.add("d-none");
  try {
    const res = await state.dashboardSb.from("guestbook").select("id, nama, pesan, is_approved, created_at").order("created_at", { ascending: false }).limit(500) as { error?: Error; data?: GuestbookEntry[] | null };
    if (res.error) throw res.error;
    state.allGb = res.data || [];
    renderGbList();
  } catch (_err) {
    const el = document.getElementById("gb-status");
    if (el) {
      el.textContent = "Gagal memuat guestbook.";
      el.classList.add("show");
    }
  }
}

function renderGbList(): void {
  const container = document.getElementById("gb-list")!;
  container.innerHTML = "";
  let filtered = state.allGb as GuestbookEntry[];
  if (state.gbFilter === "pending") filtered = (state.allGb as GuestbookEntry[]).filter((e: GuestbookEntry) => !e.is_approved);
  else if (state.gbFilter === "approved") filtered = (state.allGb as GuestbookEntry[]).filter((e: GuestbookEntry) => e.is_approved);
  const emptyEl = document.getElementById("gb-empty");
  if (emptyEl) emptyEl.classList.toggle("d-none", filtered.length !== 0);
  filtered.forEach((entry: GuestbookEntry) => {
    const card = document.createElement("div");
    card.className = "gb-admin-card" + (entry.is_approved ? "" : " pending");
    card.innerHTML = '<div class="gb-admin-header"><span class="gb-admin-name">' + escapeHtml(entry.nama) + '</span><span class="gb-admin-time">' + formatDate(entry.created_at) + '</span></div><div class="gb-admin-body">' + escapeHtml(entry.pesan) + '</div><div class="gb-admin-actions"><button class="' + (entry.is_approved ? "btn-danger" : "btn-sm") + '" data-id="' + entry.id + '" onclick="toggleGbApproval(\'' + entry.id + "', " + !entry.is_approved + ', this)">' + (entry.is_approved ? "Sembunyikan" : "Tampilkan") + "</button></div>";
    container.appendChild(card);
  });
}

export async function toggleGbApproval(id: string, newVal: boolean, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true; const origText = btn.textContent; btn.textContent = "Memproses...";
  try {
    const res = await state.dashboardSb.from("guestbook").update({ is_approved: newVal }).eq("id", id) as { error?: Error };
    if (res.error) throw res.error;
    const entry = (state.allGb as GuestbookEntry[]).find((e: GuestbookEntry) => e.id === id);
    if (entry) entry.is_approved = newVal;
    renderGbList();
    showToast(newVal ? "Pesan ditampilkan." : "Pesan disembunyikan.");
  } catch (_err) {
    showToast("Gagal update.", true);
    btn.disabled = false;
    btn.textContent = origText;
  }
}

export function setGbFilter(filter: string, btn: HTMLButtonElement): void {
  state.gbFilter = filter;
  document.querySelectorAll("#tab-guestbook .btn-group button").forEach((b: Element) => b.classList.remove("active"));
  btn.classList.add("active");
  renderGbList();
}
