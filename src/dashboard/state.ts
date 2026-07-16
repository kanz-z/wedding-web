// src/dashboard/state.ts — shared state untuk dashboard
// Fase 4: data dari Supabase, bukan dummy

import { supabase } from './supabase-client';
import type { Reservation } from '@/types/supabase';

/** Reservation + derived fields dari check_in_transactions */
export interface GuestWithMeta extends Reservation {
  checkedIn: number;
  checkedInAt: string | null;
  rsvp: 'hadir' | 'tidak' | 'belum';
  flag: string | null;
}

/** Daftar tamu aktif — diisi oleh fetchGuests() */
export let guestList: GuestWithMeta[] = [];

/** Loading/error state */
export let guestLoading = false;
export let guestError: string | null = null;

// --- filter / page / sort state ---
export let currentPage = 0;
export let pageSize = 10;
export let sortKey = 'name';
export let sortDir: 'asc' | 'desc' = 'asc';
export let searchQuery = '';
export let filters: Record<string, string> = { checkin: '', rsvp: '', kategori: '', kelompok: '' };
export const selectedIds = new Set<string>();

export function setCurrentPage(v: number): void { currentPage = v; }
export function setPageSize(v: number): void { pageSize = v; currentPage = 0; }
export function setSortKey(k: string): void {
  if (sortKey === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  else { sortKey = k; sortDir = 'asc'; }
  currentPage = 0;
}
export function setSearchQuery(q: string): void { searchQuery = q; currentPage = 0; }

export function resetFilters(): void {
  searchQuery = '';
  filters = { checkin: '', rsvp: '', kategori: '', kelompok: '' };
  const input = document.getElementById('guest-search') as HTMLInputElement | null;
  if (input) input.value = '';
  ['checkin', 'rsvp', 'kategori', 'kelompok'].forEach((k) => {
    const el = document.getElementById('filter-' + k) as HTMLSelectElement | null;
    if (el) el.value = '';
  });
  document.getElementById('search-box')?.classList.remove('has-value');
  currentPage = 0;
}

/** Status check-in berdasarkan checkedIn vs guest_count */
export function checkinStatus(guest: { checkedIn: number; guest_count: number }): 'sudah' | 'sebagian' | 'belum' {
  if (guest.checkedIn <= 0) return 'belum';
  if (guest.checkedIn < guest.guest_count) return 'sebagian';
  return 'sudah';
}

/** Summary statistik tamu */
export interface GuestSummary {
  total: number;
  hadirRsvp: number;
  tidakRsvp: number;
  belumRsvp: number;
  sudahCheckin: number;
  belumCheckin: number;
}

export function getGuestSummary(): GuestSummary {
  const total = guestList.length;
  const hadirRsvp = guestList.filter(g => g.rsvp === 'hadir').length;
  const tidakRsvp = guestList.filter(g => g.rsvp === 'tidak').length;
  const belumRsvp = guestList.filter(g => g.rsvp === 'belum').length;
  const sudahCheckin = guestList.filter(g => checkinStatus(g) === 'sudah').length;
  const belumCheckin = guestList.filter(g => checkinStatus(g) === 'belum').length;
  return { total, hadirRsvp, tidakRsvp, belumRsvp, sudahCheckin, belumCheckin };
}

// --- Anomaly detection (4.17) ---

function detectAnomaly(
  g: Reservation,
  checkedIn: number,
  rsvp: GuestWithMeta['rsvp'],
  allGuests: readonly GuestWithMeta[],
): string | null {
  if (checkedIn > g.guest_count) return 'Check-in melebihi kuota — override oleh admin';
  if (rsvp === 'hadir' && g.kategori === 'bukan' && g.guest_count > 2) return 'RSVP lebih dari 2 orang di luar keluarga';
  if (rsvp === 'tidak' && checkedIn > 0) return 'Tamu RSVP tidak hadir tetapi sudah check-in';
  if (g.nomor_wa) {
    const sameWa = allGuests.filter(o => o.id !== g.id && o.nomor_wa === g.nomor_wa);
    if (sameWa.length > 0) return `Nomor WhatsApp sama dengan ${sameWa[0].name}`;
  }
  const similar = allGuests.find(o => o.id !== g.id && isNameSimilar(g.name, o.name));
  if (similar) return `Nama mirip dengan ${similar.name}`;
  return null;
}

function isNameSimilar(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const nb = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen < 5) return false;
  let matches = 0;
  for (let i = 0; i < na.length - 2; i++) {
    if (nb.includes(na.substring(i, i + 3))) matches++;
  }
  const similarity = matches / Math.max(1, na.length - 2);
  return similarity > 0.5 || ((na.includes(nb) || nb.includes(na)) && maxLen > 6);
}

// --- Data fetching (4.1) ---

export async function fetchGuests(): Promise<GuestWithMeta[]> {
  guestLoading = true;
  guestError = null;

  const [resResult, ciResult] = await Promise.all([
    supabase.from('reservations').select('*').order('name', { ascending: true }),
    supabase.from('check_in_transactions').select('reservation_id, delta, created_at'),
  ]);

  if (resResult.error) {
    guestLoading = false;
    guestError = resResult.error.message;
    throw new Error(resResult.error.message);
  }

  // Build check-in aggregate map
  const ciMap = new Map<string, { checkedIn: number; checkedInAt: string | null }>();
  (ciResult.data || []).forEach((c: { reservation_id: string; delta: number; created_at: string }) => {
    const cur = ciMap.get(c.reservation_id) ?? { checkedIn: 0, checkedInAt: null as string | null };
    cur.checkedIn += c.delta;
    if (!cur.checkedInAt || c.created_at > cur.checkedInAt) cur.checkedInAt = c.created_at;
    ciMap.set(c.reservation_id, cur);
  });

  const rawList: GuestWithMeta[] = (resResult.data || []).map((r: Reservation) => {
    const ci = ciMap.get(r.id) ?? { checkedIn: 0, checkedInAt: null };
    const rsvp: GuestWithMeta['rsvp'] =
      r.approval_status === 'approved' ? 'hadir' :
      r.approval_status === 'rejected' ? 'tidak' : 'belum';
    return { ...r, checkedIn: ci.checkedIn, checkedInAt: ci.checkedInAt, rsvp, flag: null };
  });

  guestList = rawList.map(g => ({
    ...g,
    flag: detectAnomaly(g, g.checkedIn, g.rsvp, rawList),
  }));
  guestLoading = false;
  return guestList;
}

// --- CRUD operations (4.13, 4.15, 4.16) ---

export async function insertGuest(guest: {
  name: string;
  guest_count: number;
  kelompok: string | null;
  kategori: 'keluarga' | 'bukan';
  nomor_wa: string | null;
  notes: string | null;
}): Promise<GuestWithMeta> {
  const slug =
    guest.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    Math.random().toString(36).substring(2, 8);
  const qrToken = 'qr_' + Math.random().toString(36).substring(2, 14);

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      slug,
      qr_token: qrToken,
      name: guest.name,
      guest_count: guest.guest_count,
      kelompok: guest.kelompok,
      kategori: guest.kategori,
      nomor_wa: guest.nomor_wa,
      notes: guest.notes,
      approval_status: 'approved',
      edited_status: 'admin',
    })
    .select('*')
    .single();

  if (error) throw error;

  const g: GuestWithMeta = {
    ...(data as Reservation),
    checkedIn: 0,
    checkedInAt: null,
    rsvp: 'hadir',
    flag: null,
  };
  guestList = [...guestList, g].sort((a, b) => a.name.localeCompare(b.name));
  return g;
}

export async function updateGuest(
  id: string,
  expectedVersion: number,
  updates: {
    name?: string;
    guest_count?: number;
    kelompok?: string | null;
    kategori?: 'keluarga' | 'bukan';
    nomor_wa?: string | null;
    notes?: string | null;
  },
): Promise<GuestWithMeta> {
  const { data, error } = await supabase
    .from('reservations')
    .update({
      ...updates,
      edited_status: 'admin',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Data telah berubah. Silakan refresh.');

  const idx = guestList.findIndex(g => g.id === id);
  if (idx !== -1) {
    const existing = guestList[idx];
    guestList[idx] = {
      ...existing,
      ...(data as Reservation),
      checkedIn: existing.checkedIn,
      checkedInAt: existing.checkedInAt,
      rsvp: existing.rsvp,
      flag: existing.flag,
    };
  }

  return guestList[idx];
}

export async function addCheckin(
  reservationId: string,
  adminId: string,
  delta: number,
  method: 'qr' | 'manual' = 'manual',
  isOverride = false,
  notes: string | null = null,
): Promise<void> {
  const { error } = await supabase
    .from('check_in_transactions')
    .insert({
      reservation_id: reservationId,
      admin_id: adminId,
      delta,
      method,
      is_override: isOverride,
      notes,
    });

  if (error) throw error;

  const idx = guestList.findIndex(g => g.id === reservationId);
  if (idx !== -1) {
    const newCheckedIn = guestList[idx].checkedIn + delta;
    guestList[idx] = {
      ...guestList[idx],
      checkedIn: newCheckedIn,
      checkedInAt: new Date().toISOString(),
      flag: detectAnomaly(guestList[idx], newCheckedIn, guestList[idx].rsvp, guestList),
    };
  }
}

// --- Audit log (4.18) ---

export interface CheckinLogEntry {
  id: string;
  reservationId: string;
  guestName: string;
  adminName: string;
  delta: number;
  method: 'qr' | 'manual';
  isOverride: boolean;
  notes: string | null;
  createdAt: string;
}

export async function fetchCheckinLog(): Promise<CheckinLogEntry[]> {
  const { data, error } = await supabase
    .from('check_in_transactions')
    .select('id, reservation_id, admin_id, delta, method, is_override, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  const guestNames = new Map(guestList.map(g => [g.id, g.name]));
  const { data: admins } = await supabase.from('admin_users').select('id, email');
  const adminNames = new Map(
    (admins || []).map((a: { id: string; email: string }) => [a.id, a.email]),
  );

  return (data as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    reservationId: row.reservation_id as string,
    guestName: guestNames.get(row.reservation_id as string) ?? '(tidak dikenal)',
    adminName: adminNames.get(row.admin_id as string) ?? '(tidak dikenal)',
    delta: row.delta as number,
    method: row.method as 'qr' | 'manual',
    isOverride: row.is_override as boolean,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
  }));
}

// --- Realtime (4.19) ---

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function setupRealtime(onUpdate: (guest: GuestWithMeta) => void): () => void {
  realtimeChannel = supabase
    .channel('reservations-changes')
    .on(
      'postgres_changes' as never,
      { event: '*', schema: 'public', table: 'reservations' } as never,
      (payload: { eventType: string; new: Reservation; old: Record<string, unknown> }) => {
        if (payload.eventType === 'INSERT') {
          const rsvp: GuestWithMeta['rsvp'] =
            payload.new.approval_status === 'approved' ? 'hadir' :
            payload.new.approval_status === 'rejected' ? 'tidak' : 'belum';
          const g: GuestWithMeta = {
            ...payload.new, checkedIn: 0, checkedInAt: null, rsvp, flag: null,
          };
          guestList = [...guestList, g].sort((a, b) => a.name.localeCompare(b.name));
          onUpdate(g);
        } else if (payload.eventType === 'UPDATE') {
          const idx = guestList.findIndex(g => g.id === payload.new.id);
          if (idx !== -1) {
            guestList[idx] = {
              ...guestList[idx],
              ...payload.new,
              flag: detectAnomaly(payload.new, guestList[idx].checkedIn, guestList[idx].rsvp, guestList),
            };
            onUpdate(guestList[idx]);
          }
        } else if (payload.eventType === 'DELETE') {
          const id = payload.old.id as string;
          guestList = guestList.filter(g => g.id !== id);
        }
      },
    )
    .subscribe();

  return () => {
    realtimeChannel?.unsubscribe();
    realtimeChannel = null;
  };
}
