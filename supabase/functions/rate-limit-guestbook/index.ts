// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak di-set");
}
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
  "anjing", "babi", "bangsat", "goblok", "tolol",
  "bodoh", "kontol", "memek", "jancok", "jancuk",
  "ngentot", "bajingan", "brengsek", "laknat", "sialan",
  "kampret", "bego", "setan",
];

function sensorKataKasar(text: string): boolean {
  for (let i = 0; i < KATA_KASAR.length; i++) {
    if (new RegExp("\\b" + KATA_KASAR[i] + "\\b", "i").test(text)) return true;
  }
  return false;
}

// Serialize error object menjadi string untuk response/debug
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
    const { nama, pesan, reservation_id } = body;

    if (!nama || !pesan) {
      return new Response(
        JSON.stringify({ error: "Nama dan ucapan wajib diisi." }),
        { status: 400, headers },
      );
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
    console.log("[guestbook] step 1: cek rate limit, ip=" + ip);
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await sb
      .from("rate_limits_guestbook")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", since);

    if (countError) {
      console.error("rate-limit-guestbook: SELECT rate_limits_guestbook gagal:", dumpError(countError));
      throw countError;
    }

    if (count && count >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ error: "Terlalu banyak permintaan. Silakan coba lagi dalam beberapa menit.", rate_limited: true }),
        { status: 429, headers },
      );
    }

    // Insert ke rate_limits_guestbook
    console.log("[guestbook] step 3: insert rate limit");
    const { error: rateError } = await sb
      .from("rate_limits_guestbook")
      .insert([{ ip_address: ip }]);

    if (rateError) {
      console.error("rate-limit-guestbook: INSERT rate_limits_guestbook gagal:", dumpError(rateError));
      throw rateError;
    }

    // Insert guestbook (pakai service_role, tembus RLS)
    console.log("[guestbook] step 5: insert guestbook");
    const { error: insertError } = await sb.from("guestbook").insert([
      { reservation_id: reservation_id || null, name: nama, message: pesan, is_approved: true },
    ]);

    if (insertError) {
      console.error("rate-limit-guestbook: INSERT guestbook gagal:", dumpError(insertError));
      throw insertError;
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    const debug = dumpError(err);
    console.error("Rate limit guestbook error:", JSON.stringify(debug));

    // Ekstrak pesan yang bisa ditampilkan ke user
    const msg = String(debug.message || debug.details || debug.hint || "Internal Server Error");
    const code = debug.code || "UNKNOWN";

    return new Response(
      JSON.stringify({ error: msg, code, _debug: debug }),
      { status: 500, headers },
    );
  }
});
