// Centralized initialization of all third-party clients used by the backend.
// Importing from one place keeps configuration (and the security-critical key
// choices) in a single, auditable spot.
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import Stripe from "stripe";
import { GoogleGenAI } from "@google/genai";

// ── Supabase ────────────────────────────────────────────────────────────────
// Trusted server-side code uses the SERVICE ROLE key, which bypasses RLS. Because
// of that, EVERY user-facing endpoint MUST derive the acting user from their
// verified JWT (see lib/auth.ts) and scope queries to that user — never trust an
// id from the request body. The service role key must NEVER be VITE_-prefixed.
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabaseKey = serviceRoleKey || anonKey;

if (!serviceRoleKey) {
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY is not set — falling back to the anon key. " +
      "Cron jobs, the Stripe webhook and email logs will not work once RLS is enabled. " +
      "Set SUPABASE_SERVICE_ROLE_KEY in your server environment variables."
  );
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

// ── Stripe ──────────────────────────────────────────────────────────────────
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
export const stripe: Stripe | null = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// ── Gemini (server-side ONLY) ─────────────────────────────────────────────────
// Prefer the non-VITE key so it's never inlined into the browser bundle. The
// VITE_GEMINI_API_KEY fallback is transitional — once GEMINI_API_KEY is set in
// Vercel, DELETE VITE_GEMINI_API_KEY so it can never be exposed client-side.
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
if (!geminiApiKey) {
  console.warn("GEMINI_API_KEY is not set — AI extraction/insights endpoints will return 503.");
}
export const genai: GoogleGenAI | null = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
export const STORAGE_BUCKET = "bill-documents";

// ── Resend (email) ────────────────────────────────────────────────────────────
if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY environment variable is not set. Email features will not work.");
}
export const resend = new Resend(process.env.RESEND_API_KEY);
export const defaultFromEmail = process.env.EMAIL_FROM || "CreditTrack <onboarding@resend.dev>";
