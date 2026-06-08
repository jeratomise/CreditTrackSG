// Scheduled email jobs. In production these are invoked via Vercel Cron hitting
// /api/trigger-* (see routes/triggers.ts); in local dev they're scheduled in-process
// by server.ts. Pass a testUserId to target a single user (and force-send to the
// test inbox) for manual testing.
import { supabase } from "./lib/clients";
import { esc, maskCardName, getDaysRemaining } from "./lib/util";
import { sendEmail } from "./lib/email";

export async function runDailyReminders(testUserId?: string) {
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
            <p>Hello ${esc(user.name)},</p>
            <p>You have credit card bills that are due in <strong>3 days or less</strong>. To avoid late fees and protect your credit score, please arrange payment for the following bills immediately:</p>
            <ul style="background: #fffbeb; padding: 20px 40px; border-radius: 8px; border: 1px solid #fde68a;">
        `;

        upcomingBills.forEach((b: any) => {
          const maskedCard = esc(maskCardName(b.card_name));
          const amount = `$${b.total_amount.toFixed(2)}`;
          const d = new Date(b.due_date);
          const dueDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          const daysLeft = getDaysRemaining(b.due_date);
          const urgency = daysLeft < 0 ? `<span style="color: #dc2626; font-weight: bold;">(OVERDUE)</span>` : `<span style="color: #d97706; font-weight: bold;">(Due in ${daysLeft} days)</span>`;
          emailHtml += `<li style="margin-bottom: 10px;"><strong>${maskedCard}</strong> (${esc(b.bank_name)})<br/>Amount: <strong>${amount}</strong><br/>Deadline: <strong>${dueDate}</strong> ${urgency}</li>`;
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

export async function runWeeklyUpdate(testUserId?: string) {
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
          <p>Hello ${esc(user.name)},</p>
          <p>Here is your weekly overview of your credit card bills. Please review your outstanding balances and schedule your payments for the week.</p>
      `;

      // Sort unpaid bills by urgency (most urgent first)
      const sortedUnpaid = [...unpaidBills].sort((a, b) => {
        const daysA = getDaysRemaining(a.due_date);
        const daysB = getDaysRemaining(b.due_date);
        return daysA - daysB;
      });

      emailHtml += `<h3 style="color: #dc2626; border-bottom: 1px solid #eee; padding-bottom: 8px;">🔴 Bills Needing Payment</h3>`;
      if (sortedUnpaid.length > 0) {
        emailHtml += `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Card</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Amount</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Due Date</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Status</th>
              </tr>
            </thead>
            <tbody>
 `;
        sortedUnpaid.forEach((b: any) => {
          const daysLeft = getDaysRemaining(b.due_date);
          const maskedCard = esc(maskCardName(b.card_name));
          const amount = `$${b.total_amount.toFixed(2)}`;
          const d = new Date(b.due_date);
          const dueDateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

          // Urgency styling
          let rowBg, statusBg, statusColor, statusText;
          if (daysLeft < 0) {
            rowBg = '#fef2f2';
            statusBg = '#dc2626';
            statusColor = '#ffffff';
            statusText = `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
          } else if (daysLeft <= 3) {
            rowBg = '#fef2f2';
            statusBg = '#dc2626';
            statusColor = '#ffffff';
            statusText = `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
          } else if (daysLeft <= 7) {
            rowBg = '#fffbeb';
            statusBg = '#f59e0b';
            statusColor = '#ffffff';
            statusText = `Due in ${daysLeft} days`;
          } else if (daysLeft <= 14) {
            rowBg = '#fef9c3';
            statusBg = '#eab308';
            statusColor = '#ffffff';
            statusText = `Due in ${daysLeft} days`;
          } else {
            rowBg = '#f9fafb';
            statusBg = '#6b7280';
            statusColor = '#ffffff';
            statusText = `Due in ${daysLeft} days`;
          }

          emailHtml += `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 12px; background: ${rowBg};">
                <strong style="color: #111827;">${maskedCard}</strong><br/>
                <span style="font-size: 12px; color: #6b7280;">${esc(b.bank_name)}</span>
              </td>
              <td style="padding: 12px; text-align: right; background: ${rowBg};">
                <strong style="color: #111827; font-size: 16px;">${amount}</strong>
              </td>
              <td style="padding: 12px; text-align: right; background: ${rowBg};">
                <span style="color: #374151;">${dueDateStr}</span>
              </td>
              <td style="padding: 12px; text-align: center; background: ${rowBg};">
                <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: ${statusBg}; color: ${statusColor};">
                  ${statusText}
                </span>
              </td>
            </tr>
          `;
        });
        emailHtml += `
            </tbody>
          </table>
          <p style="font-size: 14px; color: #374151; margin-bottom: 24px;">
            <strong>Action required:</strong> Please arrange payments for the bills above before their deadlines to avoid late fees and interest charges.
</p>
        `;
      } else {
        emailHtml += `
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="color: #065f46; font-weight: bold; margin: 0;">✅ Great news — all your bills are paid up! No action needed this week.</p>
          </div>
        `;
      }

      // Recently paid bills
      const recentPaid = paidBills.slice(0, 5);
      emailHtml += `<h3 style="color: #059669; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 30px;">🟢 Recently Paid</h3>`;
      if (recentPaid.length > 0) {
        emailHtml += `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tbody>
        `;
        recentPaid.forEach((b: any) => {
          const maskedCard = esc(maskCardName(b.card_name));
          const amount = `$${b.total_amount.toFixed(2)}`;
          emailHtml += `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0;">
                <strong style="color: #111827;">${maskedCard}</strong>
                <span style="color: #6b7280; font-size: 13px;"> ${esc(b.bank_name)}</span>
              </td>
              <td style="padding: 10px 0; text-align: right;">
                <span style="color: #059669; font-weight: 600;">${amount}</span>
                <span style="margin-left: 8px; font-size: 11px; background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 9999px; font-weight: 600;">PAID</span>
              </td>
            </tr>
          `;
        });
        emailHtml += `</tbody></table>`;
      } else {
        emailHtml += `<p style="color: #9ca3af;">No recently paid bills.</p>`;
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
