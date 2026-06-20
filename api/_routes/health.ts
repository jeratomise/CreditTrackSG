import { Router } from "express";
import { supabase } from "../_lib/clients.js";
import { requireAuth } from "../_lib/auth.js";

// System + admin utility routes. NOTE: kept together in one router (rather than a
// separate admin.ts) on purpose — Vercel turns each api/*.ts file into its own
// serverless function, and the Hobby plan caps deployments at 12 functions, so we
// avoid adding new route files. Add new utility/admin endpoints here.
const router = Router();

router.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Backend status check: Supabase, Resend, Gemini
router.get("/api/status", async (_req, res) => {
  const status = {
    supabase: "error" as "ok" | "error",
    resend: "error" as "ok" | "error",
    gemini: "error" as "ok" | "error",
  };

  if (supabase) {
    try {
      const { error } = await supabase.from("system_config").select("id").limit(1);
      if (!error) status.supabase = "ok";
    } catch { /* remains error */ }
  }

  // Check Resend by hitting their REST API directly — avoids SDK method uncertainty
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error("RESEND_API_KEY not set");
    const resp = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    // 401 = invalid key; anything else (200, 403) means Resend is reachable
    if (resp.status !== 401) status.resend = "ok";
  } catch { /* network error — remains error */ }

  if (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY) {
    status.gemini = "ok";
  }

  res.json(status);
});

// GET /api/admin/users — admin-only. Merges Supabase auth.users (which includes
// users who have signed up but not yet confirmed/logged in) with the profiles table,
// so the Admin Portal can show PENDING signups immediately — before the user has
// confirmed their email or created a profile row on first login.
//
// The browser can't read auth.users directly (not exposed via PostgREST), so this
// runs server-side with the service-role key, gated by auth + an admin check.
router.get("/api/admin/users", requireAuth, async (req: any, res) => {
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  // Caller must be an admin (verified from their own profile).
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", req.authUser.id)
    .single();
  if (me?.role !== "admin") return res.status(403).json({ error: "Admin only" });

  try {
    // Profiles = users who have logged in at least once (role/status/name live here).
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, email, name, role, status, created_at");
    if (pErr) throw pErr;
    const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));

    // All auth users, including unconfirmed. Paginate defensively.
    const authUsers: any[] = [];
    const perPage = 200;
    for (let page = 1; page <= 25; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const batch = data?.users || [];
      authUsers.push(...batch);
      if (batch.length < perPage) break;
    }

    const merged = authUsers.map((au: any) => {
      const p = profileById.get(au.id);
      // Pending = signed up but no profile yet (hasn't confirmed + logged in).
      const pending = !p;
      return {
        id: au.id,
        email: au.email || p?.email || "",
        name: p?.name || au.user_metadata?.name || (au.email ? au.email.split("@")[0] : ""),
        role: (p?.role || "user") as "admin" | "user" | "pro",
        status: (pending ? "pending" : p?.status || "active") as "active" | "suspended" | "pending",
        pending,
        joinedAt: p?.created_at || au.created_at,
      };
    });

    // Pending first, then most-recently-joined.
    merged.sort((a, b) => {
      if (a.pending !== b.pending) return a.pending ? -1 : 1;
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    });

    res.json(merged);
  } catch (err: any) {
    console.error("Error listing admin users:", err?.message || err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

export default router;
