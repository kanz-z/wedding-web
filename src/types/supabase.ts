/** Baris reservasi — satu rombongan tamu, diwakili satu QR */
export interface Reservation {
  id: string;
  slug: string;
  qr_token: string;
  name: string;
  guest_count: number;
  kelompok: string | null;
  kategori: 'keluarga' | 'bukan';
  nomor_wa: string | null;
  approval_status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  edited_status: 'rsvp' | 'admin' | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  rejected_at: string | null;
}

/** Transaksi check-in — ledger immutable, hanya INSERT */
export interface CheckInTransaction {
  id: string;
  reservation_id: string;
  admin_id: string;
  delta: number;
  method: 'qr' | 'manual';
  is_override: boolean;
  notes: string | null;
  created_at: string;
}

/** Pengguna admin dashboard */
export interface AdminUser {
  id: string;
  email: string;
  role: 'superadmin' | 'admin' | 'operator' | 'couple';
  created_at: string;
}

/** Entri buku tamu (guestbook) */
export interface GuestbookEntry {
  id: string;
  reservation_id: string | null;
  name: string;
  message: string;
  is_approved: boolean;
  created_at: string;
}

/** Rate limiting untuk submit RSVP */
export interface RateLimitRsvp {
  id: string;
  ip_address: string;
  created_at: string;
}

/** Rate limiting untuk submit guestbook */
export interface RateLimitGuestbook {
  id: string;
  ip_address: string;
  created_at: string;
}

// --- Legacy types (digunakan oleh main page) — tetap dipertahankan untuk kompatibilitas ---
// GAP-019: @deprecated — gunakan Reservation, GuestbookEntry, CheckInTransaction sebagai gantinya

/** @deprecated Gunakan Reservation */
export interface DbGuest {
  id: string;
  nama: string;
  slug: string;
  token: string;
  phone: string | null;
  address: string | null;
  created_at: string;
}

/** @deprecated Gunakan Reservation & CheckInTransaction */
export interface DbRsvp {
  id: string;
  guest_id: string;
  nama: string;
  jumlah_hadir: number;
  status: 'hadir' | 'tidak_hadir' | 'pending';
  pesan: string | null;
  nomor_wa: string | null;
  is_approved: boolean;
  qr_token: string | null;
  created_at: string;
}

/** @deprecated Gunakan GuestbookEntry */
export interface DbGuestbook {
  id: string;
  rsvp_id: string | null;
  nama: string;
  pesan: string;
  is_approved: boolean;
  created_at: string;
}

/** @deprecated Gunakan CheckInTransaction */
export interface DbCheckinLog {
  rsvp_id: { nama: string } | null;
  checked_in_at: string;
  method: string;
  guest_count_actual: number;
}
