// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apiKey",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
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

    if (countError) throw countError;

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

    if (rateError) throw rateError;

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
      // Keluarga: tidak dibatasi 2 orang
      // Bukan (non-keluarga): maksimal 2 orang
      var invitedCount = existing.guest_count;
      if (existing.kategori === "keluarga") {
        newApprovalStatus = "approved";
        isApproved = true;
      } else if (invitedCount <= 2) {
        newApprovalStatus = "approved";
        isApproved = true;
      } else {
        // Non-keluarga dengan invited_count > 2 — perlu approval admin
        newApprovalStatus = "pending";
        isApproved = false;
      }
    }

    // Update reservasi dengan data RSVP
    var updateData: Record<string, unknown> = {
      name: nama,
      nomor_wa: waClean || null,
      guest_count: hadir,
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

    if (updateError) throw updateError;

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
    console.error("Rate limit RSVP error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : JSON.stringify(err),
      }),
      { status: 500, headers },
    );
  }
});
