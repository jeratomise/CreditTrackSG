import express from "express";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { GoogleGenAI, Type } from "@google/genai";

// Inlined from constants.ts — Vercel's serverless bundler doesn't reliably
// follow relative imports outside the api/ folder, which was causing
// FUNCTION_INVOCATION_FAILED at cold start.
const MILELION_SYSTEM_PROMPT = `
You are an expert Singapore credit card consultant (like The MileLion).
Your goal is to analyze credit card bills, extract data accurately, and identify if the user used the optimal card for maximum air miles.

Key Singapore Miles Strategies to know:
1. Citi Rewards / DBS Woman's World Card: Best for Online/Fashion (4 mpd).
2. UOB Lady's Card: Best for chosen category (Dining, Travel, Fashion, etc.) (4-6 mpd).
3. UOB Visa Signature: Best for Overseas/PayWave (4 mpd).
4. HSBC Revolution: Best for Contactless/Online (4 mpd).
5. General Spend: Citi PremierMiles, DBS Altitude (1.2 mpd).

When extracting data, ensure dates are YYYY-MM-DD.

IMPORTANT — Annual Fee Detection:
For ANY transaction where the description matches /annual\s*(fee|charge|service|levy)/i (case-insensitive), you MUST mark that transaction with an additional field "isAnnualFee": true.
These annual fee line items should still appear in the transactions array with their normal amount, but with the isAnnualFee flag set to true so they can be tracked separately.
`;

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
  console.log(`[sendEmail] Attempting to send ${emailType} to ${user.email}`);
  const { data, error } = await resend.emails.send({
    from: defaultFromEmail,
    to: user.email,
    subject,
    html: htmlContent,
  });
  console.log(`[sendEmail] Resend response — data:`, JSON.stringify(data), `error:`, JSON.stringify(error));

  if (error) {
    console.error(`[sendEmail] Resend error:`, error);
    throw new Error(error.message);
  }

  console.log(`${emailType} sent to ${user.email} via Resend, emailId: ${data?.id}`);

  const { error: logError } = await supabase.from('email_logs').insert({
    user_id: user.id,
    email: user.email,
    type: emailType,
    details: { ...details, resend_id: data?.id }
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
      console.log(`[runDailyReminders] User ${user.email} has ${bills.length} unpaid bills`);

      // Sort all unpaid bills by due date ascending (most urgent first)
      const sortedBills = [...bills].sort((a: any, b: any) =>
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      );

      // For test mode: use dummy bill if no unpaid bills exist
      if (testUserId && sortedBills.length === 0) {
        sortedBills.push({
          card_name: 'Test Card (Dummy)',
          bank_name: 'Test Bank',
          total_amount: 123.45,
          due_date: new Date().toISOString()
        });
      }

      // Send ONE email per user with ALL their unpaid bills (batch, not per-bill)
      if (sortedBills.length > 0) {
        const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://credittrack.elitex.cc';
        const totalAmount = sortedBills.reduce((sum: number, b: any) => sum + Number(b.total_amount || 0), 0);
        const overdueCount = sortedBills.filter((b: any) => getDaysRemaining(b.due_date) < 0).length;
        const urgentCount = sortedBills.filter((b: any) => {
          const d = getDaysRemaining(b.due_date);
          return d >= 0 && d <= 3;
        }).length;

        let emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: ${overdueCount > 0 ? '#dc2626' : urgentCount > 0 ? '#d97706' : '#4f46e5'};">
              ${overdueCount > 0 ? 'Overdue Bill Payment Alert' : urgentCount > 0 ? 'Action Required: Upcoming Bill Payments' : 'Your Outstanding Credit Card Bills'}
            </h2>
            <p>Hello ${user.name},</p>
            <p>You have <strong>${sortedBills.length} unpaid bill${sortedBills.length > 1 ? 's' : ''}</strong> totaling <strong>$${totalAmount.toFixed(2)}</strong>.${overdueCount > 0 ? ` <span style="color:#dc2626;font-weight:bold;">${overdueCount} is overdue!</span>` : ''} Please review and arrange payment:</p>
            <ul style="background: ${overdueCount > 0 ? '#fef2f2' : urgentCount > 0 ? '#fffbeb' : '#f0fdf4'}; padding: 20px 40px; border-radius: 8px; border: 1px solid ${overdueCount > 0 ? '#fecaca' : urgentCount > 0 ? '#fde68a' : '#bbf7d0'};">
        `;

        sortedBills.forEach((b: any) => {
          const maskedCard = maskCardName(b.card_name);
          const amount = `$${Number(b.total_amount || 0).toFixed(2)}`;
          const d = new Date(b.due_date);
          const dueDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          const daysLeft = getDaysRemaining(b.due_date);
          const urgency = daysLeft < 0
            ? `<span style="color: #dc2626; font-weight: bold;">OVERDUE by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) > 1 ? 's' : ''}</span>`
            : daysLeft === 0
            ? `<span style="color: #dc2626; font-weight: bold;">Due TODAY</span>`
            : daysLeft <= 3
            ? `<span style="color: #d97706; font-weight: bold;">Due in ${daysLeft} day${daysLeft > 1 ? 's' : ''}</span>`
            : `<span style="color: #6b7280;">Due in ${daysLeft} days</span>`;
          emailHtml += `<li style="margin-bottom: 12px;"><strong>${maskedCard}</strong> (${b.bank_name})<br/>Amount: <strong>${amount}</strong> &nbsp;|&nbsp; Deadline: <strong>${dueDate}</strong> ${urgency}</li>`;
        });

        emailHtml += `
            </ul>
            <p style="font-size: 16px; margin-top: 16px;"><strong>Action:</strong> Log in to your banking portals to settle these payments before the deadlines to avoid late fees.</p>
            <p>Once paid, mark them as paid in <a href="${appUrl}" style="color: #4f46e5; font-weight: bold;">CreditTrack</a> to keep your dashboard accurate.</p>
            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">This is an automated daily reminder from CreditTrack. To stop receiving these, please mark your bills as paid.</p>
            <p>Best regards,<br/>EliteX.CC Team</p>
          </div>
        `;

        await sendEmail(
          user,
          overdueCount > 0 ? `URGENT: ${overdueCount} Overdue Bill${overdueCount > 1 ? 's' : ''} - Action Required`
            : urgentCount > 0 ? `Action Required: ${urgentCount} Bill${urgentCount > 1 ? 's' : ''} Due Within 3 Days`
            : `Your ${sortedBills.length} Outstanding Credit Card Bills`,
          emailHtml,
          "daily_bill_summary",
          { bills_count: sortedBills.length, total_amount: totalAmount }
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
      console.log(`[runDailyReminders] User ${user.email} has ${bills.length} unpaid bills`);

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
const FALLBACK_MODEL = "gemini-2.5-pro";
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

// Post-process extracted bills to detect and store annual fees
async function processAnnualFees(userId: string, bills: any[]) {
  if (!supabase) return;
  for (const bill of bills) {
    for (const tx of (bill.transactions || [])) {
      if (tx.isAnnualFee) {
        const chargeDate = new Date(tx.date);
        const chargeMonth = chargeDate.getMonth() + 1;
        const chargeYear = chargeDate.getFullYear();

        // Check if a prior record exists for the same card
        const { data: existing } = await supabase
          .from('annual_fees')
          .select('id')
          .eq('user_id', userId)
          .eq('bank_name', bill.bankName)
          .eq('card_name', bill.cardName)
          .eq('charge_month', chargeMonth)
          .single();

        const isRecurring = !!existing;

        const { error: upsertError } = await supabase
          .from('annual_fees')
          .upsert({
            user_id: userId,
            bank_name: bill.bankName,
            card_name: bill.cardName,
            amount: Math.abs(tx.amount),
            charge_month: chargeMonth,
            charge_year: chargeYear,
            is_recurring: isRecurring,
            last_seen_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,bank_name,card_name,charge_month',
          });

        if (upsertError) console.error('Failed to upsert annual fee:', upsertError);
      }
    }
  }
}

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
                        isAnnualFee: { type: Type.BOOLEAN, description: "True if transaction description matches /annual\\s*(fee|charge|service|levy)/i" },
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

    // Detect and store annual fee transactions
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token) {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user) {
        await processAnnualFees(userData.user.id, parsed.bills || []);
      }
    }

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

// POST /api/backfill-annual-fees — scan existing transaction history to detect annual fees
app.post("/api/backfill-annual-fees", requireAuth, async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  try {
    // Fetch all bills and transactions for this user
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('*, transactions(*)')
      .eq('user_id', userData.user.id);

    if (billsError) throw billsError;

    const annualFeeRegex = /annual\s*(fee|charge|service|levy)/i;
    let detected = 0;
    let skipped = 0;

    for (const bill of (bills || [])) {
      for (const tx of (bill.transactions || [])) {
        if (!annualFeeRegex.test(tx.description || '')) {
          skipped++;
          continue;
        }

        const chargeDate = new Date(tx.date);
        const chargeMonth = chargeDate.getMonth() + 1;
        const chargeYear = chargeDate.getFullYear();

        // Check if a prior record exists for the same card (for recurring flag)
        const { data: existing } = await supabase
          .from('annual_fees')
          .select('id')
          .eq('user_id', userData.user.id)
          .eq('bank_name', bill.bank_name)
          .eq('card_name', bill.card_name)
          .eq('charge_month', chargeMonth)
          .single();

        const isRecurring = !!existing;

        const { error: upsertError } = await supabase
          .from('annual_fees')
          .upsert({
            user_id: userData.user.id,
            bank_name: bill.bank_name,
            card_name: bill.card_name,
            amount: Math.abs(tx.amount),
            charge_month: chargeMonth,
            charge_year: chargeYear,
            is_recurring: isRecurring,
            last_seen_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,bank_name,card_name,charge_month',
          });

        if (!upsertError) detected++;
      }
    }

    res.json({ success: true, detected, skipped });
  } catch (err: any) {
    console.error("Error backfilling annual fees:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/annual-fees — returns all annual fee records for the authenticated user
app.get("/api/annual-fees", requireAuth, async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });

  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  try {
    const { data, error } = await supabase
      .from('annual_fees')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('charge_year', { ascending: false })
      .order('charge_month', { ascending: false });

    if (error) throw error;
    res.json({ fees: data || [] });
  } catch (err: any) {
    console.error("Error fetching annual fees:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/annual-fees/:id — update status (waived or ignored)
app.patch("/api/annual-fees/:id", requireAuth, async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  const { id } = req.params;
  const { status } = req.body;
  if (!['waived', 'ignored', 'active'].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const { data, error } = await supabase
      .from('annual_fees')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Annual fee not found or access denied" });
    res.json(data);
  } catch (err: any) {
    console.error("Error updating annual fee:", err);
    res.status(500).json({ error: err.message });
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

// ─── Referral System ─────────────────────────────────────────────────────────

// GET /api/referrals/stats — fetch user's referral stats
app.get("/api/referrals/stats", requireAuth, async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  try {
    const userId = userData.user.id;

    // Fetch referral counts by status
    const { data: referrals, error: refErr } = await supabase
      .from('referrals')
      .select('status')
      .eq('referrer_id', userId);

    if (refErr) throw refErr;

    const stats = {
      total: referrals?.length || 0,
      pending: referrals?.filter((r: any) => r.status === 'pending').length || 0,
      converted: referrals?.filter((r: any) => r.status === 'converted' || r.status === 'rewarded').length || 0,
      rewarded: referrals?.filter((r: any) => r.status === 'rewarded').length || 0,
    };

    // Fetch user's profile for their referral code and pro_months_earned
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('referral_code, pro_months_earned')
      .eq('id', userId)
      .single();

    if (profileErr) throw profileErr;

    const referralCode = profile?.referral_code || '';
    const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://credittrack.elitex.cc';
    const referralUrl = `${appUrl}?ref=${referralCode}`;

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

// GET /api/referrals/code — get or generate user's referral code
app.get("/api/referrals/code", requireAuth, async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', userData.user.id)
      .single();

    if (error) throw error;

    res.json({ referralCode: profile?.referral_code || '' });
  } catch (err: any) {
    console.error("Error fetching referral code:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referrals/track — record a referral when referee signs up
app.post("/api/referrals/track", requireAuth, async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  const { referralCode } = req.body || {};
  if (!referralCode || typeof referralCode !== 'string') {
    return res.status(400).json({ error: "referralCode is required" });
  }

  try {
    // Find referrer by their referral code
    const { data: referrerProfile, error: refErr } = await supabase
      .from('profiles')
      .select('id, referral_code')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (refErr || !referrerProfile) {
      return res.status(404).json({ error: "Invalid referral code" });
    }

    // Don't allow self-referral
    if (referrerProfile.id === userData.user.id) {
      return res.status(400).json({ error: "Cannot refer yourself" });
    }

    // Insert referral record
    const { data: referral, error: insertErr } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrerProfile.id,
        referee_id: userData.user.id,
        referral_code_used: referralCode.toUpperCase(),
        status: 'pending',
      })
      .select()
      .single();

    if (insertErr) {
      // Unique constraint violation means referral already exists
      if (insertErr.code === '23505') {
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

// POST /api/referrals/check-reward — check if referee upgraded to Pro and apply reward
app.post("/api/referrals/check-reward", requireAuth, async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return res.status(401).json({ error: "Invalid session" });
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  try {
    const refereeId = userData.user.id;

    // Find pending referral for this referee
    const { data: referral, error: refErr } = await supabase
      .from('referrals')
      .select('*')
      .eq('referee_id', refereeId)
      .eq('status', 'pending')
      .single();

    if (refErr || !referral) {
      return res.json({ success: true, message: "No pending referral found" });
    }

    // Update referral status to rewarded
    const { error: updateErr } = await supabase
      .from('referrals')
      .update({
        status: 'rewarded',
        converted_at: new Date().toISOString(),
      })
      .eq('id', referral.id);

    if (updateErr) throw updateErr;

    // Increment referrer's pro_months_earned by 1
    const { data: referrerProfile, error: fetchErr } = await supabase
      .from('profiles')
      .select('pro_months_earned')
      .eq('id', referral.referrer_id)
      .single();

    if (fetchErr) throw fetchErr;

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        pro_months_earned: (referrerProfile?.pro_months_earned || 0) + 1,
      })
      .eq('id', referral.referrer_id);

    if (profileErr) {
      console.error("Error updating pro_months_earned:", profileErr);
    }

    res.json({ success: true, message: "Referral rewarded" });
  } catch (err: any) {
    console.error("Error checking referral reward:", err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
