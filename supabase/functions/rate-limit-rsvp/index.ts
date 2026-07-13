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
  "http://localhost:5173", // Vite
  "http://localhost:5174", // Vite
  "http://127.0.0.1:5500", // Live Server
  "http://localhost:4173/",
];
