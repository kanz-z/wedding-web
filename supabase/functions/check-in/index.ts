// Supabase Edge Function: /check-in
// Fase 5.3 — Atomic check-in via database transaction (fn_check_in)
// Dipanggil dari state.ts addCheckin() dan checkin.ts
// @ts-nocheck

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const ALLOWED_ORIGINS = [
  "https://wedding-web-reza-shila-2026.netlify.app",
  "https://wedding-web-reza-shila-2026.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5500",
  "http://localhost:4173",
  "https://wedding-invitation-1-git-main-kanzzs-projects.vercel.app",
];

interface CheckInPayload {
  reservation_id: string;
  delta: number;
  method: "qr" | "manual";
  is_override?: boolean;
  notes?: string | null;
  idempotency_key?: string;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, apikey, x-client-info",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
      },
    });
  }

  try {
    // Parse body
    const body: CheckInPayload = await req.json();

    if (!body.reservation_id || !body.delta || !body.method) {
      return new Response(
        JSON.stringify({
          error: "reservation_id, delta, dan method wajib diisi",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
          },
        },
      );
    }

    // Verify auth — extract JWT from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — token tidak ditemukan" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
          },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Get user from token
    const { data: userData, error: userError } = await sb.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — token tidak valid" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
          },
        },
      );
    }

    // Verify admin role
    const { data: adminRow } = await sb
      .from("admin_users")
      .select("id, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!adminRow) {
      return new Response(
        JSON.stringify({ error: "Forbidden — bukan admin" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
          },
        },
      );
    }

    // Idempotency check — jika key sudah dipakai, return hasil sebelumnya
    if (body.idempotency_key) {
      const { data: existing } = await sb
        .from("check_in_transactions")
        .select("id, delta, method, created_at")
        .eq("idempotency_key", body.idempotency_key)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            idempotent: true,
            ...existing,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
            },
          },
        );
      }
    }

    // Call atomic check-in function
    const { data, error } = await sb.rpc("fn_check_in", {
      p_reservation_id: body.reservation_id,
      p_admin_id: userData.user.id,
      p_delta: body.delta,
      p_method: body.method,
      p_is_override: body.is_override ?? false,
      p_notes: body.notes ?? null,
      p_idempotency_key: body.idempotency_key ?? null,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
        },
      });
    }

    const result = data as Record<string, unknown>;

    if (result.error) {
      const status = (result.needs_override as boolean) ? 409 : 422;
      return new Response(JSON.stringify(result), {
        status,
        headers: {
          "Content-Type": "application/json",
          ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
        },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
        },
      },
    );
  }
});
