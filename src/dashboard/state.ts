// src/dashboard/state.ts — shared state untuk dashboard

import type { Reservation } from '@/types/supabase';

/** Data dummy — nanti diganti fetch dari Supabase di Fase 4 */
export const GUESTS: Reservation[] = [
  { id: "g1", slug: "aufa-kanz-a82js9", qr_token: "qr_aufa", name: "Muhammad Aufa Kanz Anindito", guest_count: 3, kelompok: "Keluarga Ashila", kategori: "keluarga", nomor_wa: "0812-3456-7890", approval_status: "approved", edited_status: "rsvp", notes: null, version: 1, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z", approved_at: "2026-07-01T00:00:00Z", rejected_at: null },
  { id: "g2", slug: "siti-amara-x91qe2", qr_token: "qr_siti", name: "Siti Amara", guest_count: 1, kelompok: "Teman Kuliah Ashila", kategori: "bukan", nomor_wa: "0813-2211-0098", approval_status: "approved", edited_status: null, notes: null, version: 1, created_at: "2026-07-02T00:00:00Z", updated_at: "2026-07-02T00:00:00Z", approved_at: "2026-07-02T00:00:00Z", rejected_at: null },
  { id: "g3", slug: "damar-w-k77rtz", qr_token: "qr_damar", name: "Damar Wicaksono", guest_count: 4, kelompok: "Kolega Kantor Reza", kategori: "bukan", nomor_wa: "0857-7723-1190", approval_status: "approved", edited_status: null, notes: null, version: 1, created_at: "2026-07-03T00:00:00Z", updated_at: "2026-07-03T00:00:00Z", approved_at: "2026-07-03T00:00:00Z", rejected_at: null },
  { id: "g4", slug: "keluarga-danurdoro", qr_token: "qr_danur", name: "Keluarga Danurdoro", guest_count: 6, kelompok: "Keluarga Ashila", kategori: "keluarga", nomor_wa: "0811-9090-1122", approval_status: "approved", edited_status: null, notes: null, version: 1, created_at: "2026-07-04T00:00:00Z", updated_at: "2026-07-04T00:00:00Z", approved_at: "2026-07-04T00:00:00Z", rejected_at: null },
  { id: "g5", slug: "farah-okta-p33lmv", qr_token: "qr_farah", name: "Farah Oktaviani", guest_count: 2, kelompok: "Teman Kantor Ashila", kategori: "bukan", nomor_wa: "0822-4455-6677", approval_status: "approved", edited_status: null, notes: null, version: 1, created_at: "2026-07-05T00:00:00Z", updated_at: "2026-07-05T00:00:00Z", approved_at: "2026-07-05T00:00:00Z", rejected_at: null },
  { id: "g6", slug: "bagas-nararya", qr_token: "qr_bagas", name: "Bagas Nararya", guest_count: 2, kelompok: "Sahabat Reza", kategori: "bukan", nomor_wa: "0856-1230-9988", approval_status: "approved", edited_status: "admin", notes: null, version: 2, created_at: "2026-07-06T00:00:00Z", updated_at: "2026-07-06T00:00:00Z", approved_at: "2026-07-06T00:00:00Z", rejected_at: null },
  { id: "g7", slug: "keluarga-andriani", qr_token: "qr_andri", name: "Keluarga Besar Andriani", guest_count: 8, kelompok: "Keluarga Reza", kategori: "keluarga", nomor_wa: "0813-7788-2233", approval_status: "approved", edited_status: null, notes: null, version: 1, created_at: "2026-07-07T00:00:00Z", updated_at: "2026-07-07T00:00:00Z", approved_at: "2026-07-07T00:00:00Z", rejected_at: null },
  { id: "g8", slug: "nadia-kirana", qr_token: "qr_nadia", name: "Nadia Kirana", guest_count: 2, kelompok: "Teman SMA Ashila", kategori: "bukan", nomor_wa: "0819-3344-5566", approval_status: "approved", edited_status: "rsvp", notes: null, version: 1, created_at: "2026-07-08T00:00:00Z", updated_at: "2026-07-08T00:00:00Z", approved_at: "2026-07-08T00:00:00Z", rejected_at: null },
  { id: "g9", slug: "yusuf-maulana", qr_token: "qr_yusuf", name: "Yusuf Maulana", guest_count: 1, kelompok: "Kolega Kantor Reza", kategori: "bukan", nomor_wa: "0878-2299-4411", approval_status: "approved", edited_status: null, notes: null, version: 1, created_at: "2026-07-09T00:00:00Z", updated_at: "2026-07-09T00:00:00Z", approved_at: "2026-07-09T00:00:00Z", rejected_at: null },
  { id: "g10", slug: "intan-permatasari", qr_token: "qr_intan", name: "Intan Permatasari", guest_count: 1, kelompok: "Teman Kuliah Ashila", kategori: "bukan", nomor_wa: "0812-6677-8899", approval_status: "approved", edited_status: null, notes: null, version: 1, created_at: "2026-07-10T00:00:00Z", updated_at: "2026-07-10T00:00:00Z", approved_at: "2026-07-10T00:00:00Z", rejected_at: null },
  { id: "g11", slug: "galih-prakoso", qr_token: "qr_galih", name: "Galih Prakoso", guest_count: 2, kelompok: "Sahabat Reza", kategori: "bukan", nomor_wa: "0857-1122-3344", approval_status: "approved", edited_status: null, notes: null, version: 1, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", approved_at: "2026-07-11T00:00:00Z", rejected_at: null },
  { id: "g12", slug: "keluarga-hastono", qr_token: "qr_hastono", name: "Keluarga Hastono", guest_count: 5, kelompok: "Keluarga Reza", kategori: "keluarga", nomor_wa: "0811-2233-4455", approval_status: "approved", edited_status: null, notes: null, version: 1, created_at: "2026-07-12T00:00:00Z", updated_at: "2026-07-12T00:00:00Z", approved_at: "2026-07-12T00:00:00Z", rejected_at: null },
];

export interface GuestCheckin {
  checkedIn: number;
  checkedInAt: string | null;
  rsvp: 'hadir' | 'tidak' | 'belum';
  flag: string | null;
}

/** Runtime check-in / RSVP data (nanti dari derived fields Supabase) */
export const guestMeta: Record<string, GuestCheckin> = {
  g1: { checkedIn: 3, checkedInAt: "2026-08-22T10:14:00", rsvp: "hadir", flag: null },
  g2: { checkedIn: 0, checkedInAt: null, rsvp: "belum", flag: null },
  g3: { checkedIn: 0, checkedInAt: null, rsvp: "hadir", flag: "RSVP lebih dari 2 orang di luar keluarga" },
  g4: { checkedIn: 7, checkedInAt: "2026-08-22T11:05:00", rsvp: "hadir", flag: "Check-in melebihi kuota — override oleh admin" },
  g5: { checkedIn: 1, checkedInAt: "2026-08-22T09:02:00", rsvp: "hadir", flag: null },
  g6: { checkedIn: 0, checkedInAt: null, rsvp: "tidak", flag: null },
  g7: { checkedIn: 0, checkedInAt: null, rsvp: "belum", flag: null },
  g8: { checkedIn: 2, checkedInAt: "2026-08-22T10:41:00", rsvp: "hadir", flag: null },
  g9: { checkedIn: 1, checkedInAt: "2026-08-22T08:55:00", rsvp: "hadir", flag: null },
  g10: { checkedIn: 0, checkedInAt: null, rsvp: "belum", flag: null },
  g11: { checkedIn: 0, checkedInAt: null, rsvp: "tidak", flag: null },
  g12: { checkedIn: 5, checkedInAt: "2026-08-22T09:30:00", rsvp: "hadir", flag: null },
};

// --- filter / page / sort state ---
export let currentPage = 0;
export let pageSize = 10;
export let sortKey = "name";
export let sortDir: 'asc' | 'desc' = "asc";
export let searchQuery = "";
export let filters: Record<string, string> = { checkin: "", rsvp: "", kategori: "", kelompok: "" };
export const selectedIds = new Set<string>();
export let guestTableInited = false;

export function setCurrentPage(v: number): void { currentPage = v; }
export function setPageSize(v: number): void { pageSize = v; currentPage = 0; }
export function setSortKey(k: string): void {
  if (sortKey === k) sortDir = sortDir === "asc" ? "desc" : "asc";
  else { sortKey = k; sortDir = "asc"; }
  currentPage = 0;
}
export function setSearchQuery(q: string): void { searchQuery = q; currentPage = 0; }

export function resetFilters(): void {
  searchQuery = "";
  filters = { checkin: "", rsvp: "", kategori: "", kelompok: "" };
  const input = document.getElementById("guest-search") as HTMLInputElement | null;
  if (input) input.value = "";
  ["checkin", "rsvp", "kategori", "kelompok"].forEach((k) => {
    const el = document.getElementById("filter-" + k) as HTMLSelectElement | null;
    if (el) el.value = "";
  });
  document.getElementById("search-box")?.classList.remove("has-value");
  currentPage = 0;
}

export function checkinStatus(meta: GuestCheckin, guestCount: number): 'sudah' | 'sebagian' | 'belum' {
  if (meta.checkedIn <= 0) return "belum";
  if (meta.checkedIn < guestCount) return "sebagian";
  return "sudah";
}
