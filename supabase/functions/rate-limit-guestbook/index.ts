// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 menit

const ALLOWED_ORIGINS = [
  "https://wedding-web-reza-shila-2026.netlify.app",
  "https://wedding-web-reza-shila-2026.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5500",
  "http://localhost:4173",
];

const KATA_KASAR = [
  "anjing", "babi", "bangsat", "goblok", "tolol", "bodoh",
  "kontol", "memek", "jancok", "jancuk", "ngentot", "bajingan",
  "brengsek", "laknat", "sialan", "kampret", "bego", "setan",
];

function sensorKataKasar(text: string): boolean {
  for (let i = 0; i < KATA_KASAR.length; i++) {
    if (new RegExp("\\b" + KATA_KASAR[i] + "\\b", "i").test(text)) return true;
  }
  return false;
}

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
    const { nama, pesan, reservation_id } = body;

    if (!nama || !pesan) {
      return new Response(JSON.stringify({ error: "Nama dan ucapan wajib diisi." }), {
        status: 400,
        headers,
      });
    }

    if (pesan.length > 500) {
      return new Response(
        JSON.stringify({ error: "Ucapan terlalu panjang, maksimal 500 karakter." }),
        { status: 400, headers },
      );
    }

    if (sensorKataKasar(pesan)) {
      return new Response(
        JSON.stringify({ error: "Ucapan mengandung kata tidak pantas." }),
        { status: 400, headers },
      );
    }

    // Cek rate limit
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await sb
      .from("rate_limits_guestbook")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", since);

    if (countError) throw countError;

    if (count && count >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({
          error: "Terlalu banyak permintaan. Silakan coba lagi dalam beberapa menit.",
          rate_limited: true,
        }),
        { status: 429, headers },
      );
    }

    // Insert ke rate_limits_guestbook
    const { error: rateError } = await sb
      .from("rate_limits_guestbook")
      .insert([{ ip_address: ip }]);

    if (rateError) throw rateError;

    // Insert guestbook (pakai service_role, tembus RLS)
    const { error: insertError } = await sb
      .from("guestbook")
      .insert([{ reservation_id: reservation_id || null, name: nama, message: pesan, is_approved: true }]);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error("Rate limit guestbook error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : JSON.stringify(err),
      }),
      { status: 500, headers },
    );
  }
});
