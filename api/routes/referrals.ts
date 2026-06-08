import { Router } from "express";
import { supabase } from "../lib/clients";
import { requireAuth } from "../lib/auth";
import { validate, referralTrackSchema } from "../lib/validation";

const router = Router();

// POST /api/referrals/backfill — generate referral codes for profiles missing one (admin only)
router.post("/api/referrals/backfill", requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData?.user) return res.status(401).json({ error: "Invalid session" });

  // Only admins can trigger backfill
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (profile?.role !== "admin") return res.status(403).json({ error: "Admin only" });

  try {
    const { data: missing } = await supabase.from("profiles").select("id").is("referral_code", null);
    if (!missing || missing.length === 0) {
      return res.json({ success: true, message: "All profiles already have codes", count: 0 });
    }

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (const row of missing) {
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      await supabase.from("profiles").update({ referral_code: code }).eq("id", row.id);
    }

    res.json({ success: true, count: missing.length });
  } catch (err: any) {
    console.error("Backfill error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referrals/stats — fetch the user's referral stats
router.get("/api/referrals/stats", requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });

  try {
    const userId = userData.user.id;

    const { data: referrals, error: refErr } = await supabase
      .from("referrals")
      .select("status")
      .eq("referrer_id", userId);

    if (refErr) throw refErr;

    const stats = {
      total: referrals?.length || 0,
      pending: referrals?.filter((r: any) => r.status === "pending").length || 0,
      converted: referrals?.filter((r: any) => r.status === "converted" || r.status === "rewarded").length || 0,
      rewarded: referrals?.filter((r: any) => r.status === "rewarded").length || 0,
    };

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("referral_code, pro_months_earned")
      .eq("id", userId)
      .single();

    if (profileErr) throw profileErr;

    const referralCode = profile?.referral_code || "";
    const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || "https://credittrack.elitex.cc";
    const referralUrl = appUrl + "?ref=" + referralCode;

    res.json({
      ...stats,
      referralCode,
      referralUrl,
      proMonthsEarned: profile?.pro_months_earned || 0,
    });
  } catch (err: any) {
    console.error("Error fetching referral stats:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referrals/code — get the user's referral code
router.get("/api/referrals/code", requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", userData.user.id)
      .single();

    if (error) throw error;
    res.json({ referralCode: profile?.referral_code || "" });
  } catch (err: any) {
    console.error("Error fetching referral code:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referrals/track — record a referral when a referee signs up
router.post("/api/referrals/track", requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });

  const parsed = validate(referralTrackSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { referralCode } = parsed.data;

  try {
    const { data: referrerProfile, error: refErr } = await supabase
      .from("profiles")
      .select("id, referral_code")
      .eq("referral_code", referralCode.toUpperCase())
      .single();

    if (refErr || !referrerProfile) {
      return res.status(404).json({ error: "Invalid referral code" });
    }

    if (referrerProfile.id === userData.user.id) {
      return res.status(400).json({ error: "Cannot refer yourself" });
    }

    const { data: referral, error: insertErr } = await supabase
      .from("referrals")
      .insert({
        referrer_id: referrerProfile.id,
        referee_id: userData.user.id,
        referral_code_used: referralCode.toUpperCase(),
        status: "pending",
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        return res.json({ success: true, message: "Referral already recorded" });
      }
      throw insertErr;
    }

    res.json({ success: true, referral });
  } catch (err: any) {
    console.error("Error tracking referral:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referrals/check-reward — reward the referrer once the referee is a paid Pro
router.post("/api/referrals/check-reward", requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });

  try {
    const refereeId = userData.user.id;

    const { data: referral, error: refErr } = await supabase
      .from("referrals")
      .select("*")
      .eq("referee_id", refereeId)
      .eq("status", "pending")
      .single();

    if (refErr || !referral) {
      return res.json({ success: true, message: "No pending referral found" });
    }

    // ANTI-ABUSE: only reward when the referee is a genuine PAYING Pro subscriber
    // (has a Stripe subscription set by the verified webhook). Without this check,
    // two colluding accounts could farm unlimited free Pro months for the referrer.
    const { data: refereeProfile } = await supabase
      .from("profiles")
      .select("role, stripe_subscription_id")
      .eq("id", refereeId)
      .single();

    if (refereeProfile?.role !== "pro" || !refereeProfile?.stripe_subscription_id) {
      return res.json({ success: true, message: "Referral not yet eligible — referee is not a paid Pro subscriber" });
    }

    await supabase
      .from("referrals")
      .update({ status: "rewarded", converted_at: new Date().toISOString() })
      .eq("id", referral.id);

    const { data: referrerProfile, error: fetchErr } = await supabase
      .from("profiles")
      .select("pro_months_earned")
      .eq("id", referral.referrer_id)
      .single();

    if (fetchErr) throw fetchErr;

    await supabase
      .from("profiles")
      .update({ pro_months_earned: (referrerProfile?.pro_months_earned || 0) + 1 })
      .eq("id", referral.referrer_id);

    res.json({ success: true, message: "Referral rewarded" });
  } catch (err: any) {
    console.error("Error checking referral reward:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
