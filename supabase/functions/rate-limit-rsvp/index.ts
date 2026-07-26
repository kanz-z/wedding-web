// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak di-set");
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 menit

const ALLOWED_ORIGINS = [
  "https://wedding-web-reza-shila-2026.netlify.app",
  "https://wedding-web-reza-shila-2026.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5500",
  "http://localhost:4173",
];

serve(async (req) => {
  const origin = req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apiKey",
      },
    });
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Content-Type": "application/json",
  };

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers,
      });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const body = await req.json();
    const { guest_id, nama, nomor_wa, jumlah_hadir, status, pesan, qr_token } =
      body;

    if (!nama || !status) {
      return new Response(JSON.stringify({ error: "Data tidak lengkap" }), {
        status: 400,
        headers,
      });
    }

    // Validasi format nomor WA (hanya jika diisi)
    const waClean = nomor_wa ? nomor_wa.replace(/[\s\-\(\)]/g, "") : "";
    if (nomor_wa && !/^\d{10,15}$/.test(waClean)) {
      return new Response(
        JSON.stringify({
          error: "Nomor WA tidak valid. Minimal 10 digit angka.",
        }),
        { status: 400, headers },
      );
    }

    if (pesan && pesan.length > 500) {
      return new Response(
        JSON.stringify({
          error: "Pesan terlalu panjang, maksimal 500 karakter",
        }),
        { status: 400, headers },
      );
    }

    var hadir = parseInt(jumlah_hadir);
    if (isNaN(hadir) || hadir < 1) {
      return new Response(
        JSON.stringify({ error: "Jumlah hadir tidak valid" }),
        { status: 400, headers },
      );
    }

    // Cek rate limit
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await sb
      .from("rate_limits_rsvp")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", since);

    if (countError) {
      console.error(
        "rate-limit-rsvp: SELECT rate_limits_rsvp gagal:",
        JSON.stringify(countError),
      );
      throw countError;
    }

    if (count && count >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({
          error:
            "Terlalu banyak permintaan. Silakan coba lagi dalam beberapa menit.",
          rate_limited: true,
        }),
        { status: 429, headers },
      );
    }

    // Catat rate limit
    const { error: rateError } = await sb
      .from("rate_limits_rsvp")
      .insert([{ ip_address: ip }]);

    if (rateError) {
      console.error(
        "rate-limit-rsvp: INSERT rate_limits_rsvp gagal:",
        JSON.stringify(rateError),
      );
      throw rateError;
    }

    // GAP-004: cek event status dari event_config
    const { data: eventStatusData } = await sb
      .from("event_config")
      .select("value")
      .eq("key", "event_status")
      .maybeSingle();

    if (eventStatusData) {
      const raw = eventStatusData.value as string;
      const eventStatus = JSON.parse(raw);
      if (eventStatus === "offline") {
        return new Response(
          JSON.stringify({
            error: "Acara sedang offline. RSVP tidak dapat dilakukan saat ini.",
          }),
          { status: 503, headers },
        );
      }
    }

    // GAP-001: baca config approval mode dari event_config
    let approvalMode: Record<string, unknown> = {
      type: "auto",
      threshold_non_keluarga: 2,
    };
    const { data: amData } = await sb
      .from("event_config")
      .select("value")
      .eq("key", "approval_mode")
      .maybeSingle();

    if (amData) {
      approvalMode = amData.value as Record<string, unknown>;
    }

    // Tentukan approval_status dari status yang dikirim client
    // "Hadir" → approved jika dalam batas, atau pending
    // "Tidak Hadir" → "rejected"
    const isHadir = status === "Hadir";

    // Cari reservasi existing
    var reservationId = guest_id || null;

    if (!reservationId) {
      // Tidak ada guest_id — coba cari lewat nama + nomor_wa
      if (nama && waClean) {
        var { data: foundByNameWa } = await sb
          .from("reservations")
          .select("id, kategori, guest_count")
          .eq("name", nama)
          .eq("nomor_wa", waClean)
          .maybeSingle();
        if (foundByNameWa) reservationId = foundByNameWa.id;
      }

      if (!reservationId && nama) {
        var { data: foundByName } = await sb
          .from("reservations")
          .select("id, kategori, guest_count")
          .ilike("name", nama)
          .limit(1)
          .maybeSingle();
        if (foundByName) reservationId = foundByName.id;
      }

      if (!reservationId) {
        return new Response(
          JSON.stringify({
            error:
              "Undangan tidak ditemukan. Gunakan link undangan yang benar.",
          }),
          { status: 404, headers },
        );
      }
    }

    // Ambil data reservasi untuk menentukan approval
    var { data: existing } = await sb
      .from("reservations")
      .select(
        "id, slug, qr_token, name, guest_count, kategori, approval_status, version",
      )
      .eq("id", reservationId)
      .single();

    if (!existing) {
      return new Response(
        JSON.stringify({ error: "Undangan tidak ditemukan." }),
        { status: 404, headers },
      );
    }

    // Tentukan approval berdasarkan business rules
    var newApprovalStatus: string;
    var isApproved: boolean;

    if (!isHadir) {
      // "Tidak Hadir" → langsung rejected
      newApprovalStatus = "rejected";
      isApproved = true; // rejected itu final, bukan pending
    } else {
      // "Hadir" — cek apakah auto-approved
      // Gunakan config approval_mode dari database (GAP-001)
      var invitedCount = existing.guest_count;
      const modeType = (approvalMode.type as string) || "auto";
      const threshold = (approvalMode.threshold_non_keluarga as number) || 2;

      if (modeType === "manual") {
        // Always manual — semua perlu approval
        newApprovalStatus = "pending";
        isApproved = false;
      } else if (modeType === "auto") {
        // Always auto — semua langsung approved
        newApprovalStatus = "approved";
        isApproved = true;
      } else {
        // Threshold mode (default behavior)
        // Keluarga: tidak dibatasi
        // Bukan (non-keluarga): threshold-based
        if (existing.kategori === "keluarga") {
          newApprovalStatus = "approved";
          isApproved = true;
        } else if (invitedCount <= threshold) {
          newApprovalStatus = "approved";
          isApproved = true;
        } else {
          newApprovalStatus = "pending";
          isApproved = false;
        }
      }
    }

    // Update reservasi dengan data RSVP
    // GAP-006: jangan overwrite guest_count (invited count di-set admin).
    // jumlah_hadir dari tamu disimpan sebagai rsvp_count, bukan guest_count.
    var updateData: Record<string, unknown> = {
      name: nama,
      nomor_wa: waClean || null,
      approval_status: newApprovalStatus,
      notes: pesan || existing.notes,
      edited_status: "rsvp",
      version: (existing.version || 1) + 1,
      updated_at: new Date().toISOString(),
    };

    // Hanya update qr_token jika belum ada
    if (!existing.qr_token && qr_token) {
      updateData.qr_token = qr_token;
    }

    if (newApprovalStatus === "approved") {
      updateData.approved_at = new Date().toISOString();
    } else if (newApprovalStatus === "rejected") {
      updateData.rejected_at = new Date().toISOString();
    }

    var { data: updated, error: updateError } = await sb
      .from("reservations")
      .update(updateData)
      .eq("id", reservationId)
      .select("qr_token, guest_count, notes")
      .single();

    if (updateError) {
      console.error(
        "rate-limit-rsvp: INSERT RSVP gagal:",
        JSON.stringify(updateError),
      );
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          is_approved: isApproved,
          qr_token: updated.qr_token,
          jumlah_hadir: updated.guest_count,
          pesan: updated.notes,
        },
      }),
      { status: 200, headers },
    );
  } catch (err) {
    function dumpError(e: unknown): Record<string, unknown> {
      if (typeof e !== "object" || e === null) return { _value: String(e) };
      const obj = e as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      try {
        for (const k of Object.getOwnPropertyNames(obj)) {
          const v = obj[k];
          if (typeof v === "function") continue;
          out[k] = v;
        }
      } catch {
        out._string = String(e);
      }
      return out;
    }

    const debug = dumpError(err);
    console.error("Rate limit RSVP error:", JSON.stringify(debug));

    const msg = String(debug.message || debug.details || debug.hint || "Internal Server Error");
    const code = debug.code || "UNKNOWN";

    return new Response(
      JSON.stringify({ error: "Terjadi kesalahan internal. Silakan coba lagi." }),
      { status: 500, headers },
    );
  }
});
