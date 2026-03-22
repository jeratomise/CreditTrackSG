import express from "express";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client for the backend
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_fWZSWDXy_67Xs4xDxjdbqkjYRiqC2a5SM');
const defaultFromEmail = process.env.EMAIL_FROM || 'CreditTrack <onboarding@resend.dev>';

// Helper to mask credit card names/numbers
function maskCardName(name: string) {
  // If it contains numbers, mask them except last 4
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

  // Log the email to the database
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
    // Fetch all active users, or just the test user
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

    // Fetch unpaid bills for these users
    const { data: allBills, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .in('user_id', userIds)
      .eq('is_paid', false);

    if (billsError) throw billsError;

    // Group bills by user
    const billsByUser = (allBills || []).reduce((acc: any, bill: any) => {
      if (!acc[bill.user_id]) acc[bill.user_id] = [];
      acc[bill.user_id].push(bill);
      return acc;
    }, {});

    for (const user of users) {
      if (testUserId) {
        user.email = 'jeratomise@gmail.com'; // Force send to this email for testing
      }
      const bills = billsByUser[user.id] || [];

      let upcomingBills = bills.filter((b: any) => {
        const daysLeft = getDaysRemaining(b.due_date);
        return daysLeft <= 3; // Remind for unpaid bills due in <= 3 days or overdue
      });

      // If testing and no upcoming bills, inject a dummy bill to ensure the email sends
      if (testUserId && upcomingBills.length === 0) {
        upcomingBills = [{
          card_name: 'Test Card (Dummy)',
          bank_name: 'Test Bank',
          total_amount: 123.45,
          due_date: new Date().toISOString()
        }];
      }

      if (upcomingBills.length > 0) {
        // Construct email HTML
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

    // Group bills by user
    const billsByUser = (allBills || []).reduce((acc: any, bill: any) => {
      if (!acc[bill.user_id]) acc[bill.user_id] = [];
      acc[bill.user_id].push(bill);
      return acc;
    }, {});

    for (const user of users) {
      if (testUserId) {
        user.email = 'jeratomise@gmail.com'; // Force send to this email for testing
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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

  // Manual trigger for testing the cron job
  app.post("/api/trigger-reminders", async (req, res) => {
    const { userId } = req.body || {};
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

  app.post("/api/trigger-weekly", async (req, res) => {
    const { userId } = req.body || {};
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

  // Schedule daily cron job to run every day at 9:00 AM
  cron.schedule("0 9 * * *", () => {
    runDailyReminders();
  });

  // Schedule weekly cron job to run every Monday at 9:00 AM
  cron.schedule("0 9 * * 1", () => {
    runWeeklyUpdate();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
