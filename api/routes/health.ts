import { Router } from "express";
import { supabase } from "../lib/clients.js";

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

export default router;
