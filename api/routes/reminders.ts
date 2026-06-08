import { Router } from "express";
import { supabase, resend, defaultFromEmail } from "../lib/clients.js";
import { esc, maskCardName } from "../lib/util.js";
import { requireAuth } from "../lib/auth.js";
import { validate, scheduleReminderSchema, cancelReminderSchema } from "../lib/validation.js";

const router = Router();

// Schedule a reminder email via Resend scheduledAt. Auth required: the recipient and
// user_id come from the verified user, and the bill must belong to that user — so this
// can't be used to send arbitrary emails through our Resend account or spoof data.
router.post("/api/schedule-reminder", requireAuth, async (req: any, res) => {
  const parsed = validate(scheduleReminderSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { cardName, bankName, amount, dueDate, billId } = parsed.data;
  const userId = req.authUser.id;
  const userEmail = req.authUser.email;
  const userName = req.authUser.user_metadata?.name || (userEmail ? userEmail.split("@")[0] : "there");

  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  // The bill must exist and belong to the authenticated user.
  const { data: ownedBill } = await supabase
    .from("bills")
    .select("id")
    .eq("id", billId)
    .eq("user_id", userId)
    .single();
  if (!ownedBill) {
    return res.status(403).json({ error: "Bill not found for this user" });
  }

  // Reminder fires 3 days before due date at 09:00 SGT (01:00 UTC)
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - 3);
  reminderDate.setUTCHours(1, 0, 0, 0);

  const d = new Date(dueDate);
  const dueDateFormatted = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || "https://credittrack.elitex.cc";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #d97706;">Payment Reminder: ${esc(cardName)}</h2>
      <p>Hello ${esc(userName || "there")},</p>
      <p>This is a reminder that your credit card bill is due in <strong>3 days</strong>.</p>
      <div style="background: #fffbeb; padding: 20px; border-radius: 8px; border: 1px solid #fde68a; margin: 20px 0;">
        <p style="margin: 0 0 8px;"><strong>Card:</strong> ${esc(maskCardName(cardName))} (${esc(bankName)})</p>
        <p style="margin: 0 0 8px;"><strong>Amount Due:</strong> $${Number(amount).toFixed(2)}</p>
        <p style="margin: 0;"><strong>Due Date:</strong> ${dueDateFormatted}</p>
      </div>
      <p>Please log in to your banking portal to settle this payment before the due date.</p>
      <p>Once paid, mark it as paid in <a href="${appUrl}" style="color: #4f46e5; font-weight: bold;">CreditTrack</a>.</p>
      <p>Best regards,<br/>EliteX.CC Team</p>
    </div>
  `;

  const now = new Date();
  const scheduledAt = reminderDate > now ? reminderDate.toISOString() : undefined;

  const emailPayload: any = {
    from: defaultFromEmail,
    to: userEmail,
    subject: `Reminder: ${maskCardName(cardName)} due on ${dueDateFormatted}`,
    html,
  };
  if (scheduledAt) emailPayload.scheduledAt = scheduledAt;

  try {
    const { data, error } = await resend.emails.send(emailPayload);
    if (error) throw new Error(error.message);

    const emailId = data?.id;

    if (emailId && supabase) {
      await supabase.from("bills").update({ reminder_email_id: emailId }).eq("id", billId).eq("user_id", userId);

      await supabase.from("email_logs").insert({
        user_id: userId,
        email: userEmail,
        type: "bill_reminder_scheduled",
        details: { bill_id: billId, resend_email_id: emailId, scheduled_at: scheduledAt || "immediate" },
      });
    }

    res.json({ success: true, emailId, scheduledAt });
  } catch (err: any) {
    console.error("Error scheduling reminder:", err);
    res.status(500).json({ success: false, error: "Failed to schedule reminder" });
  }
});

// Cancel a previously scheduled reminder. Auth required, and the reminder must belong
// to one of the user's own bills.
router.post("/api/cancel-reminder", requireAuth, async (req: any, res) => {
  const parsed = validate(cancelReminderSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { reminderEmailId } = parsed.data;

  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  const { data: ownedBill } = await supabase
    .from("bills")
    .select("id")
    .eq("reminder_email_id", reminderEmailId)
    .eq("user_id", req.authUser.id)
    .single();
  if (!ownedBill) {
    return res.status(403).json({ error: "Reminder not found for this user" });
  }

  try {
    await resend.emails.cancel(reminderEmailId);
    res.json({ success: true });
  } catch (err: any) {
    console.warn("Could not cancel reminder email:", err.message);
    res.json({ success: false, error: "Could not cancel reminder" });
  }
});

// Returns the authenticated user's own email logs (user id from the verified JWT).
router.get("/api/email-logs", requireAuth, async (req: any, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Database connection not initialized" });
  }
  try {
    const { data, error } = await supabase
      .from("email_logs")
      .select("*")
      .eq("user_id", req.authUser.id)
      .order("sent_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error fetching email logs:", err);
    res.status(500).json({ error: "Failed to fetch email logs" });
  }
});

export default router;
