import express from "express";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { GoogleGenAI, Type } from "@google/genai";
import { MILELION_SYSTEM_PROMPT } from "../constants";

// Initialize Supabase client for the backend
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Initialize Resend — RESEND_API_KEY must be set in environment variables
if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY environment variable is not set. Email features will not work.');
}
const resend = new Resend(process.env.RESEND_API_KEY);
const defaultFromEmail = process.env.EMAIL_FROM || 'CreditTrack <onboarding@resend.dev>';

// Helper to mask credit card names/numbers
function maskCardName(name: string) {
  const hasNumbers = /\d{4,}/.test(name);
  if (hasNumbers) {
    return name.replace(/\d(?=\d{4})/g, "*");
  }
  return name;
}

// Helper to calculate days remaining
function getDaysRemaining(dueDateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper to send email and log to database
async function sendEmail(user: any, subject: string, htmlContent: string, emailType: string, details: any) {
  const { data, error } = await resend.emails.send({
    from: defaultFromEmail,
    to: user.email,
    subject,
    html: htmlContent,
  });

  if (error) {
    throw new Error(error.message);
  }

  console.log(`${emailType} sent to ${user.email} via Resend`);

  const { error: logError } = await supabase.from('email_logs').insert({
    user_id: user.id,
    email: user.email,
    type: emailType,
    details: { ...details }
  });

  if (logError) console.error("Failed to log email to database:", logError);
}

async function runDailyReminders(testUserId?: string) {
  console.log("Running daily reminder cron job...");
  if (!supabase) {
    console.log("Supabase credentials not found. Skipping cron job.");
    return;
  }

  try {
    let query = supabase.from('profiles').select('*');
    if (testUserId) {
      query = query.eq('id', testUserId);
    } else {
      query = query.eq('status', 'active');
    }

    let { data: users, error: usersError } = await query;

    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      if (testUserId) {
        users = [{ id: testUserId, name: 'Test User', email: 'jeratomise@gmail.com' }];
      } else {
        return;
      }
    }

    const userIds = users.map((u: any) => u.id);

    const { data: allBills, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .in('user_id', userIds)
      .eq('is_paid', false);

    if (billsError) throw billsError;

    const billsByUser = (allBills || []).reduce((acc: any, bill: any) => {
      if (!acc[bill.user_id]) acc[bill.user_id] = [];
      acc[bill.user_id].push(bill);
      return acc;
    }, {});

    for (const user of users) {
      if (testUserId) {
        user.email = 'jeratomise@gmail.com';
      }
      const bills = billsByUser[user.id] || [];

      let upcomingBills = bills.filter((b: any) => {
        const daysLeft = getDaysRemaining(b.due_date);
        return daysLeft <= 3;
      });

      if (testUserId && upcomingBills.length === 0) {
        upcomingBills = [{
          card_name: 'Test Card (Dummy)',
          bank_name: 'Test Bank',
          total_amount: 123.45,
          due_date: new Date().toISOString()
        }];
      }

      if (upcomingBills.length > 0) {
        const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://credittrack.elitex.cc';
        let emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #d97706;">Action Required: Urgent Bill Payment Reminder</h2>
            <p>Hello ${user.name},</p>
            <p>You have credit card bills that are due in <strong>3 days or less</strong>. To avoid late fees and protect your credit score, please arrange payment for the following bills immediately:</p>
            <ul style="background: #fffbeb; padding: 20px 40px; border-radius: 8px; border: 1px solid #fde68a;">
        `;

        upcomingBills.forEach((b: any) => {
          const maskedCard = maskCardName(b.card_name);
          const amount = `$${b.total_amount.toFixed(2)}`;
          const d = new Date(b.due_date);
          const dueDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          const daysLeft = getDaysRemaining(b.due_date);
          const urgency = daysLeft < 0 ? `<span style="color: #dc2626; font-weight: bold;">(OVERDUE)</span>` : `<span style="color: #d97706; font-weight: bold;">(Due in ${daysLeft} days)</span>`;
          emailHtml += `<li style="margin-bottom: 10px;"><strong>${maskedCard}</strong> (${b.bank_name})<br/>Amount: <strong>${amount}</strong><br/>Deadline: <strong>${dueDate}</strong> ${urgency}</li>`;
        });

        emailHtml += `
            </ul>
            <p style="font-size: 16px;"><strong>Action to take:</strong> Please log in to your respective banking portals today to clear these balances.</p>
            <p>Once paid, mark them as paid in <a href="${appUrl}" style="color: #4f46e5; font-weight: bold;">CreditTrack</a>.</p>
            <p>Best regards,<br/>EliteX.CC Team</p>
          </div>
        `;

        await sendEmail(
          user,
          "Action Required: Urgent Credit Card Bills",
          emailHtml,
          "bill_reminder",
          { bills_count: upcomingBills.length }
        );
      }
    }
  } catch (err) {
    console.error("Error in cron job:", err);
    if (testUserId) throw err;
  }
}

async function runWeeklyUpdate(testUserId?: string) {
  console.log("Running weekly update cron job...");
  if (!supabase) {
    console.log("Supabase credentials not found. Skipping cron job.");
    return;
  }

  try {
    let query = supabase.from('profiles').select('*');
    if (testUserId) {
      query = query.eq('id', testUserId);
    } else {
      query = query.eq('status', 'active');
    }
    let { data: users, error: usersError } = await query;

    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      if (testUserId) {
        users = [{ id: testUserId, name: 'Test User', email: 'jeratomise@gmail.com' }];
      } else {
        return;
      }
    }

    const userIds = users.map((u: any) => u.id);

    const { data: allBills, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .in('user_id', userIds);

    if (billsError) throw billsError;

    const billsByUser = (allBills || []).reduce((acc: any, bill: any) => {
      if (!acc[bill.user_id]) acc[bill.user_id] = [];
      acc[bill.user_id].push(bill);
      return acc;
    }, {});

    for (const user of users) {
      if (testUserId) {
        user.email = 'jeratomise@gmail.com';
      }
      const bills = billsByUser[user.id] || [];

      const unpaidBills = bills.filter((b: any) => !b.is_paid);
      const paidBills = bills.filter((b: any) => b.is_paid);

      const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://credittrack.elitex.cc';
      let emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #4f46e5;">Your Weekly Financial Update</h2>
          <p>Hello ${user.name},</p>
          <p>Here is your weekly overview of your credit card bills. Please review your outstanding balances and schedule your payments for the week.</p>
      `;

      emailHtml += `<h3 style="color: #dc2626; border-bottom: 1px solid #eee; padding-bottom: 8px;">🔴 Action Required: Unpaid Bills</h3>`;
      if (unpaidBills.length > 0) {
        emailHtml += `<ul style="background: #fef2f2; padding: 20px 40px; border-radius: 8px; border: 1px solid #fecaca;">`;
        unpaidBills.forEach((b: any) => {
          const maskedCard = maskCardName(b.card_name);
          const amount = `$${b.total_amount.toFixed(2)}`;
          const d = new Date(b.due_date);
          const dueDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          emailHtml += `<li style="margin-bottom: 10px;"><strong>${maskedCard}</strong> (${b.bank_name})<br/>Amount: <strong>${amount}</strong><br/>Deadline: <strong>${dueDate}</strong></li>`;
        });
        emailHtml += `</ul>`;
        emailHtml += `<p style="font-size: 16px;"><strong>Action to take:</strong> Schedule payments for the above bills before their respective deadlines to avoid late fees.</p>`;
      } else {
        emailHtml += `<p style="color: #059669; font-weight: bold;">Great job! You have no unpaid bills at the moment.</p>`;
      }

      emailHtml += `<h3 style="color: #059669; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 30px;">🟢 Recently Paid Bills</h3>`;
      if (paidBills.length > 0) {
        emailHtml += `<ul style="background: #ecfdf5; padding: 20px 40px; border-radius: 8px; border: 1px solid #a7f3d0;">`;
        paidBills.slice(0, 5).forEach((b: any) => {
          const maskedCard = maskCardName(b.card_name);
          const amount = `$${b.total_amount.toFixed(2)}`;
          emailHtml += `<li style="margin-bottom: 10px;"><strong>${maskedCard}</strong> (${b.bank_name}) - <strong>${amount}</strong> (Paid)</li>`;
        });
        emailHtml += `</ul>`;
      } else {
        emailHtml += `<p>No recently paid bills.</p>`;
      }

      emailHtml += `
          <p style="margin-top: 30px;">Manage your full portfolio in <a href="${appUrl}" style="color: #4f46e5; font-weight: bold;">CreditTrack</a>.</p>
          <p>Best regards,<br/>EliteX.CC Team</p>
        </div>
      `;

      await sendEmail(
        user,
        "Weekly Bill Payment Update",
        emailHtml,
        "weekly_update",
        { bills_count: bills.length }
      );
    }
  } catch (err) {
    console.error("Error in weekly cron job:", err);
    if (testUserId) throw err;
  }
}

const app = express();
// Bumped from default 100kb to 20mb so base64-encoded PDFs (up to ~10mb raw) fit.
app.use(express.json({ limit: "20mb" }));

// --- Gemini client + retry/fallback (server-side only — key stays out of browser bundle) ---
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";
const RETRYABLE_CODES = [429, 500, 502, 503, 504];
let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI | null {
  if (geminiClient) return geminiClient;
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Gemini API key missing. Set GEMINI_API_KEY in environment.");
    return null;
  }
  geminiClient = new GoogleGenAI({ apiKey });
  return geminiClient;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function isRetryable(err: any): boolean {
  const status = err?.status ?? err?.error?.code ?? err?.code;
  if (RETRYABLE_CODES.includes(Number(status))) return true;
  const msg = String(err?.message ?? "");
  if (RETRYABLE_CODES.some(c => msg.includes(`"code":${c}`))) return true;
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|DEADLINE_EXCEEDED/i.test(msg);
}

function friendlyMessage(err: any): string {
  const msg = String(err?.message ?? "");
  if (/UNAVAILABLE|503|overloaded|high demand/i.test(msg))
    return "Gemini is temporarily overloaded. Please wait a minute and try again.";
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(msg))
    return "Gemini API quota reached. Please wait a moment before retrying.";
  if (/PERMISSION_DENIED|API key|401|403|INVALID_ARGUMENT/i.test(msg))
    return "Gemini API key is invalid or lacks permission for this model.";
  return msg || "Unknown Gemini error";
}

async function callGeminiWithRetry<T>(fn: (model: string) => Promise<T>, maxAttempts = 3, baseDelayMs = 1000): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(PRIMARY_MODEL);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) throw err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 400);
        console.warn(`Gemini ${PRIMARY_MODEL} attempt ${attempt} failed (retryable). Retrying in ${delay}ms.`);
        await sleep(delay);
      }
    }
  }
  console.warn(`Gemini ${PRIMARY_MODEL} exhausted retries. Falling back to ${FALLBACK_MODEL}.`);
  try {
    return await fn(FALLBACK_MODEL);
  } catch (err) {
    throw err ?? lastError;
  }
}

// Verifies the caller is a logged-in Supabase user. Cheap protection so the
// endpoint doesn't become an open Gemini proxy that anyone can burn quota on.
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!supabase) return res.status(500).json({ error: "Auth not initialized" });
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: "Invalid session" });
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Bill statement extraction — moved server-side to avoid CORS/preflight rejection
// from browser-originated calls and to keep the API key out of the JS bundle.
app.post("/api/extract-bill", requireAuth, async (req, res) => {
  const { base64Data, mimeType } = req.body || {};
  if (!base64Data || typeof base64Data !== "string") {
    return res.status(400).json({ error: "base64Data is required" });
  }
  const ai = getGemini();
  if (!ai) return res.status(500).json({ error: "Gemini not configured" });

  try {
    const response = await callGeminiWithRetry(model => ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } },
          {
            text: `Analyze this credit card statement. It is likely a CONSOLIDATED STATEMENT containing multiple cards.

            **CRITICAL: SPLIT BY CARD**
            You must identify *every* distinct card in this document and create a separate bill entry for each.

            **DBS / POSB INSTRUCTIONS:**
            1.  **Find Card Headers**: Look for gray header bars or lines containing text like **"CARD NO.:"** (e.g., "DBS YUU AMERICAN EXPRESS CARD NO.: XXX", "DBS VANTAGE VISA INFINITE CARD NO.: XXX").
            2.  **Separate Sections**: Treat each header as the start of a completely new bill.
            3.  **Extract Specific Total**: For each card section, look for the **"SUB-TOTAL:"** or **"TOTAL:"** row *immediately following* that card's transaction list. Use this as the \`totalAmount\`. Do NOT use the document's Grand Total.
            4.  **Date**: The "Payment Due Date" is usually common for all cards in the statement (at the top of Page 1). Use that.

            **AMEX INSTRUCTIONS:**
            - Look for "Closing Balance" on the first page.
            - Date Format: Convert "DD.MM.YYYY" (e.g., 14.12.2025) strictly to "YYYY-MM-DD".

            **GENERIC RULES:**
            - **Transactions**: Assign transactions only to the card section they appear in.
            - **Card Name**: Use the specific name found in the header (e.g., "DBS Woman's World Mastercard", "DBS Vantage Visa Infinite").

            Return a JSON object with a 'bills' array containing one object per card found.`,
          },
        ],
      },
      config: {
        systemInstruction: MILELION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bankName: { type: Type.STRING },
                  cardName: { type: Type.STRING },
                  totalAmount: { type: Type.NUMBER },
                  dueDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
                  statementDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
                  transactions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        date: { type: Type.STRING, description: "YYYY-MM-DD format" },
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                      },
                    },
                  },
                },
                required: ["bankName", "totalAmount", "dueDate", "transactions"],
              },
            },
          },
        },
      },
    }));

    if (!response.text) {
      return res.status(502).json({ error: "Empty response from Gemini" });
    }
    const parsed = JSON.parse(response.text);
    res.json(parsed);
  } catch (err: any) {
    console.error("extract-bill error:", err);
    res.status(502).json({ error: friendlyMessage(err) });
  }
});

// Optimization advice — also routed through the server for the same reasons.
app.post("/api/optimize", requireAuth, async (req, res) => {
  const { transactions } = req.body || {};
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.json({ advice: "Upload bills to generate insights.", riskScore: 0, missedMiles: 0, anomalies: [] });
  }
  const ai = getGemini();
  if (!ai) return res.status(500).json({ error: "Gemini not configured" });

  try {
    const response = await callGeminiWithRetry(model => ai.models.generateContent({
      model,
      contents: `Analyze these transactions based on Singapore specific credit card strategies (Milelion).
      Identify which transactions missed a bonus mile opportunity (e.g. using a general card for online spend instead of DBS WWMC).

      **Advice Formatting:**
      Return the 'advice' field as a single string, but format it clearly as 3 distinct bullet points separated by newlines. Do not use markdown symbols like * or #. Start each point with a unicode bullet (•).

      **Risk Score:**
      Calculate a 'risk score' (0-100) based on potential for late fees or suboptimal card usage.

      Transactions JSON: ${JSON.stringify(transactions)}`,
      config: {
        systemInstruction: MILELION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            advice: { type: Type.STRING, description: "3 bullet points starting with •, separated by newlines" },
            riskScore: { type: Type.NUMBER },
            missedMiles: { type: Type.NUMBER, description: "Estimated missed miles count" },
            anomalies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of unusual transactions" },
          },
        },
      },
    }));

    if (!response.text) {
      return res.json({ advice: "Could not generate advice.", riskScore: 0, missedMiles: 0, anomalies: [] });
    }
    res.json(JSON.parse(response.text));
  } catch (err: any) {
    console.error("optimize error:", err);
    res.status(502).json({ error: friendlyMessage(err) });
  }
});

// Backend status check: Supabase, Resend, Gemini
app.get("/api/status", async (_req, res) => {
  const status = {
    supabase: 'error' as 'ok' | 'error',
    resend: 'error' as 'ok' | 'error',
    gemini: 'error' as 'ok' | 'error',
  };

  // Check Supabase with a lightweight query
  if (supabase) {
    try {
      const { error } = await supabase.from('system_config').select('id').limit(1);
      if (!error) status.supabase = 'ok';
    } catch { /* remains error */ }
  }

  // Check Resend by hitting their REST API directly — avoids SDK method uncertainty
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error('RESEND_API_KEY not set');
    const resp = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${resendKey}` }
    });
    // 401 = invalid key; anything else (200, 403) means Resend is reachable and key is recognised
    if (resp.status !== 401) status.resend = 'ok';
  } catch { /* network error — remains error */ }

  // Check Gemini by env var presence (accepts VITE_ prefixed or plain name)
  if (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY) {
    status.gemini = 'ok';
  }

  res.json(status);
});

// Schedule a reminder email via Resend scheduledAt (trigger-based, replaces daily cron)
app.post("/api/schedule-reminder", async (req, res) => {
  const { userEmail, userName, cardName, bankName, amount, dueDate, userId, billId } = req.body;

  if (!userEmail || !dueDate || !billId) {
    return res.status(400).json({ error: 'Missing required fields: userEmail, dueDate, billId' });
  }

  // Reminder fires 3 days before due date at 09:00 SGT (01:00 UTC)
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - 3);
  reminderDate.setUTCHours(1, 0, 0, 0);

  const d = new Date(dueDate);
  const dueDateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://credittrack.elitex.cc';

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #d97706;">Payment Reminder: ${cardName}</h2>
      <p>Hello ${userName || 'there'},</p>
      <p>This is a reminder that your credit card bill is due in <strong>3 days</strong>.</p>
      <div style="background: #fffbeb; padding: 20px; border-radius: 8px; border: 1px solid #fde68a; margin: 20px 0;">
        <p style="margin: 0 0 8px;"><strong>Card:</strong> ${maskCardName(cardName)} (${bankName})</p>
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

    // Store emailId on the bill for later cancellation
    if (emailId && supabase) {
      await supabase.from('bills').update({ reminder_email_id: emailId }).eq('id', billId);

      await supabase.from('email_logs').insert({
        user_id: userId,
        email: userEmail,
        type: 'bill_reminder_scheduled',
        details: { bill_id: billId, resend_email_id: emailId, scheduled_at: scheduledAt || 'immediate' }
      });
    }

    res.json({ success: true, emailId, scheduledAt });
  } catch (err: any) {
    console.error("Error scheduling reminder:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cancel a previously scheduled Resend reminder email
app.post("/api/cancel-reminder", async (req, res) => {
  const { reminderEmailId } = req.body;
  if (!reminderEmailId) return res.status(400).json({ error: 'reminderEmailId is required' });

  try {
    await resend.emails.cancel(reminderEmailId);
    res.json({ success: true });
  } catch (err: any) {
    // Non-fatal — email may have already been sent or ID may be invalid
    console.warn("Could not cancel reminder email:", err.message);
    res.json({ success: false, error: err.message });
  }
});

app.get("/api/email-logs", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  if (!supabase) {
    return res.status(500).json({ error: "Database connection not initialized" });
  }
  try {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error fetching email logs:", err);
    res.status(500).json({ error: "Failed to fetch email logs" });
  }
});

// Cron secret validation middleware
function validateCronSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
}

// GET only — called by Vercel Cron (with Authorization: Bearer CRON_SECRET header)
// Also accepts manual POST trigger for testing (same secret required)
app.all("/api/trigger-reminders", validateCronSecret, async (req, res) => {
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

// GET only — called by Vercel Cron (with Authorization: Bearer CRON_SECRET header)
app.all("/api/trigger-weekly", validateCronSecret, async (req, res) => {
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

export default app;
