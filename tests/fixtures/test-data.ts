/**
 * Test data fixtures untuk E2E tests — semua data sintetis, bukan PII asli.
 *
 * Ref: [TRD §Routing Paths], [TRD §Environment Variables], [BS §Tabel]
 */

/** Data tamu sintetis untuk RSVP submission */
export const RSVP_GUEST = {
  name: 'Test User E2E',
  guestCount: 2,
  attendance: 'Hadir' as const,
  wa: '081234567890',
  doa: 'Selamat menempuh hidup baru! (test)',
};

/** Data guestbook sintetis */
export const GUESTBOOK_ENTRY = {
  nama: 'Test Guestbook E2E',
  pesan: 'Semoga bahagia selalu! (E2E test)',
};

/** Preview mode — email apa pun diterima. Ref: halaman login */
export const ADMIN_CREDENTIALS = {
  email: 'admin@rezaashila.id',
  password: 'password123',
};

/**
 * URL paths yang diuji.
 * Ref: [TRD §Routing Paths] — /invitation/[slug] dan /invitation/[slug]/card
 */
export const ROUTES = {
  landing: '/',
  dashboard: '/dashboard.html',
  dashboardLogin: '/dashboard.html',
  dashboardHub: '/dashboard.html#hub',
  dashboardGuests: '/dashboard.html#guests',
  dashboardCheckin: '/dashboard.html#checkin',
  dashboardReservations: '/dashboard.html#reservations',
  dashboardPrivateMessages: '/dashboard.html#private',
  dashboardPublicMessages: '/dashboard.html#public',
  dashboardAdmin: '/dashboard.html#admin',
  /** [TRD §Routing Paths] Halaman utama per reservasi — form + status */
  invitationBySlug: (slug: string) => `/invitation/${slug}`,
  /** [TRD §Routing Paths] Dynamic route — kartu undangan berdasarkan slug */
  invitationCard: (slug: string) => `/invitation/${slug}/card`,
} as const;

/** Section ID di landing page */
export const LANDING_SECTIONS = {
  cover: 'home', welcome: 'welcome', info: 'info',
  countdown: 'cd', dresscode: 'dresscode', rsvp: 'rsvp',
  gifts: 'gifts', guestbook: 'guestbook-section',
} as const;

/** Supabase URL — digunakan untuk intercept network calls. Ref: [TRD §Environment Variables] */
export const SUPABASE_CONFIG = {
  url: 'https://liyfsapgadickknsfbus.supabase.co',
  /** Edge Function untuk rate-limit RSVP. Ref: [TRD §Third-Party APIs] */
  edgeFunctionRsvp: 'https://liyfsapgadickknsfbus.functions.supabase.co/rate-limit-rsvp',
  edgeFunctionGuestbook: 'https://liyfsapgadickknsfbus.functions.supabase.co/rate-limit-guestbook',
  edgeFunctionCheckin: 'https://liyfsapgadickknsfbus.functions.supabase.co/check-in',
} as const;
