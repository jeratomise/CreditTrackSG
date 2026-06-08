import { Router } from "express";
import { supabase } from "../lib/clients";
import { validateCronSecret } from "../lib/auth";
import { runDailyReminders, runWeeklyUpdate } from "../cron";

const router = Router();

// Called by Vercel Cron (Authorization: Bearer CRON_SECRET). Also accepts a manual
// POST trigger for testing (same secret required). validateCronSecret fails closed.
router.all("/api/trigger-reminders", validateCronSecret, async (req, res) => {
  const userId = req.body?.userId;
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Supabase client is not initialized. Check your environment variables." });
    }
    await runDailyReminders(userId);
    res.json({ success: true, message: "Reminders triggered successfully." });
  } catch (err: any) {
    console.error("Error triggering reminders:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to trigger reminders" });
  }
});

router.all("/api/trigger-weekly", validateCronSecret, async (req, res) => {
  const userId = req.body?.userId;
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Supabase client is not initialized. Check your environment variables." });
    }
    await runWeeklyUpdate(userId);
    res.json({ success: true, message: "Weekly update triggered successfully." });
  } catch (err: any) {
    console.error("Error triggering weekly update:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to trigger weekly update" });
  }
});

export default router;
