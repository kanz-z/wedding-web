/** Tipe untuk tabel 'guests' di Supabase */
export interface DbGuest {
  id: string;
  nama: string;
  slug: string;
  token: string;
  phone: string | null;
  address: string | null;
  created_at: string;
}

/** Tipe untuk tabel 'rsvps' di Supabase */
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

/** Tipe untuk tabel 'guestbook' di Supabase */
export interface DbGuestbook {
  id: string;
  rsvp_id: string | null;
  nama: string;
  pesan: string;
  is_approved: boolean;
  created_at: string;
}

/** Tipe untuk response dari fungsi Supabase RPC */
export interface DbCheckinLog {
  rsvp_id: { nama: string } | null;
  checked_in_at: string;
  method: string;
  guest_count_actual: number;
}
