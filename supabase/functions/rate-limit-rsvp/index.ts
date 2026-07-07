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
  "http://localhost:3000", // development
  "http://localhost:5173", // Vite dev server (jika nanti pakai Vite)
  "http://127.0.0.1:5500", // Live Server
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
        {
          status: 400,
          headers,
        },
      );
    }

    var hadir = parseInt(jumlah_hadir);
    if (isNaN(hadir) || hadir < 1) {
      return new Response(
        JSON.stringify({ error: "Jumlah hadir tidak valid" }),
        {
          status: 400,
          headers,
        },
      );
    }

    // Cek rate limit
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await sb
      .from("rate_limits")
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

    // Insert ke rate_limits
    const { error: rateError } = await sb
      .from("rate_limits")
      .insert([{ ip_address: ip }]);

    if (rateError) throw rateError;

    // Cari RSVP existing by priority
    var existingRsvp: { id: string; status: string; guest_id: string } | null =
      null;

    if (guest_id) {
      var { data } = await sb
        .from("rsvps")
        .select("id, status, guest_id")
        .eq("guest_id", guest_id)
        .maybeSingle();
      existingRsvp = data;
    }

    if (!existingRsvp && nama && waClean) {
      var { data } = await sb
        .from("rsvps")
        .select("id, status, guest_id")
        .eq("nama", nama)
        .eq("nomor_wa", waClean)
        .maybeSingle();
      existingRsvp = data;
    }

    if (!existingRsvp && nama) {
      var { data } = await sb
        .from("rsvps")
        .select("id, status, guest_id")
        .ilike("nama", nama)
        .limit(1)
        .maybeSingle();
      if (data) existingRsvp = data;
    }

    // Hitung invited_count untuk is_approved
    var gid = guest_id || (existingRsvp ? existingRsvp.guest_id : null);
    var invitedCount = hadir;
    if (gid) {
      var { data: guest } = await sb
        .from("guests")
        .select("invited_count")
        .eq("id", gid)
        .single();
      if (guest) invitedCount = guest.invited_count;
    }

    var rsvpData = {
      nama,
      nomor_wa: waClean || null,
      jumlah_hadir: hadir,
      status,
      pesan: pesan || null,
      qr_token: qr_token || crypto.randomUUID(),
      is_approved: invitedCount <= 2,
    };

    var result;
    if (existingRsvp) {
      var { data, error } = await sb
        .from("rsvps")
        .update(rsvpData)
        .eq("id", existingRsvp.id)
        .select("is_approved, qr_token, jumlah_hadir, pesan")
        .single();

      if (error) throw error;
      result = data;
    } else {
      // INSERT untuk tamu baru
      rsvpData = { ...rsvpData, guest_id: guest_id || null };
      var { data, error } = await sb
        .from("rsvps")
        .insert([rsvpData])
        .select("is_approved, qr_token, jumlah_hadir, pesan")
        .single();

      if (error) throw error;
      result = data;
    }

    // Sync nomor_wa ke guests jika sebelumnya null
    if (gid && waClean) {
      await sb
        .from("guests")
        .update({ nomor_wa: waClean })
        .eq("id", gid)
        .eq("nomor_wa", null);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error("Rate limit RSVP error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Gagal memproses RSVP",
      }),
      { status: 500, headers },
    );
  }
});
