// src/main/slug-router.ts
// Slug-based routing
// Membaca window.location.pathname, ekstrak slug, dan fetch data tamu dari Supabase.
//
// Route:
//   /                          → Cover default, tidak ada data tamu
//   /invitation/[slug]         → Halaman undangan dengan data tamu
//   /invitation/[slug]/card    → Halaman kartu undangan setelah RSVP

import { supabaseClient } from "./supabase-client";

/** Data tamu hasil fetch dari Supabase berdasarkan slug */
export interface GuestData {
  id: string;
  nama: string;
  slug: string;
  token: string | null;
}

/** Tipe route yang terdeteksi */
export type RouteType = "cover" | "undangan" | "card";

// ---------------------------------------------------------------------------
// Parse pathname
// ---------------------------------------------------------------------------
const path = window.location.pathname.replace(/\/+$/, ""); // hapus trailing slash
const segments = path.split("/").filter(Boolean);

function detectRoute(segs: string[]): { routeType: RouteType; slug: string } {
  // Format: /invitation/[slug]/card
  if (
    segs.length >= 3 &&
    segs[0] === "invitation" &&
    segs[segs.length - 1] === "card"
  ) {
    return { routeType: "card", slug: segs[1] ?? "" };
  }
  // Format: /invitation/[slug]
  if (segs.length === 2 && segs[0] === "invitation") {
    return { routeType: "undangan", slug: segs[1] ?? "" };
  }
  // Legacy: /[slug]/card
  if (segs.length === 2 && segs[1] === "card") {
    return { routeType: "card", slug: segs[0] ?? "" };
  }
  // Legacy: /[slug]
  if (segs.length === 1) {
    return { routeType: "undangan", slug: segs[0] ?? "" };
  }
  // Root or unknown
  return { routeType: "cover", slug: "" };
}

const detected = detectRoute(segments);

export const routeType: RouteType = detected.routeType;
export const slug: string = detected.slug;

// ---------------------------------------------------------------------------
// Data tamu — diisi secara async, null sebelum fetch selesai
// ---------------------------------------------------------------------------
let _guestData: GuestData | null = null;
let _fetchError: string | null = null;
let _fetchPromise: Promise<void> | null = null;

/** Mulai fetch data tamu. Aman dipanggil berkali-kali (hanya fetch sekali). */
export async function fetchGuestData(): Promise<void> {
  if (_fetchPromise) return _fetchPromise;
  if (!slug || routeType === "cover") {
    _fetchPromise = Promise.resolve();
    return _fetchPromise;
  }

  _fetchPromise = (async () => {
    try {
      const res = await supabaseClient.rpc("get_guest_by_slug", {
        slug_param: slug,
      });
      if (res.error) throw res.error;
      const data = res.data as unknown as GuestData[];
      if (!data || data.length === 0) {
        _fetchError = "Undangan tidak ditemukan";
        return;
      }
      const raw = data[0] as unknown as Record<string, unknown>;
      _guestData = {
        id: raw.id as string,
        nama: raw.name as string,
        slug: raw.slug as string,
        token: raw.qr_token as string | null,
      };
    } catch (err) {
      console.error("Gagal fetch data tamu:", err);
      _fetchError =
        err instanceof Error ? err.message : "Gagal memuat data tamu";
    }
  })();

  return _fetchPromise;
}

/** Akses data tamu yang sudah di-fetch (null jika belum selesai atau tidak ada slug) */
export function getGuestData(): GuestData | null {
  return _guestData;
}

/** Error dari fetch (null jika sukses atau belum fetch) */
export function getFetchError(): string | null {
  return _fetchError;
}

// ---------------------------------------------------------------------------
// Derived values — kompatibel dengan API url-params.ts lama
// ---------------------------------------------------------------------------

/** Nama tamu */
export function getGuestName(): string {
  return _guestData?.nama ?? "";
}

/** Sapaan — tidak ada di data reservasi baru, gunakan string kosong */
export function getPronoun(): string {
  return "";
}

/** Guest ID (reservation ID) — untuk RSVP */
export function getGuestId(): string | null {
  return _guestData?.id ?? null;
}

/** Guest token (qr_token) — untuk RSVP */
export function getGuestToken(): string | null {
  return _guestData?.token ?? null;
}
