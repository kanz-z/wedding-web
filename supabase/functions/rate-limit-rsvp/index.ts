// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 menit

serve(async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

    if (!nama || !nomor_wa || !status) {
      return new Response(JSON.stringify({ error: "Data tidak lengkap" }), {
        status: 400,
        headers,
      });
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

    // Insert ke rsvps
    const { data, error: rsvpError } = await sb
      .from("rsvps")
      .insert([
        {
          guest_id: guest_id || null,
          nama,
          nomor_wa,
          jumlah_hadir,
          status,
          pesan: pesan || null,
          qr_token: qr_token || null,
        },
      ])
      .select("is_approved, qr_token, jumlah_hadir, pesan");

    if (rsvpError) throw rsvpError;

    return new Response(
      JSON.stringify({
        success: true,
        data: data[0],
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
