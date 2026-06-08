import { resend, defaultFromEmail, supabase } from "./clients";

export interface EmailUser {
  id: string;
  email: string;
  name?: string;
}

/**
 * Send an email via Resend and record it in the email_logs table.
 * Callers are responsible for escaping any user-controlled content in `htmlContent`
 * (see lib/util.ts `esc`).
 */
export async function sendEmail(
  user: EmailUser,
  subject: string,
  htmlContent: string,
  emailType: string,
  details: Record<string, unknown>
): Promise<void> {
  const { error } = await resend.emails.send({
    from: defaultFromEmail,
    to: user.email,
    subject,
    html: htmlContent,
  });

  if (error) throw new Error(error.message);

  if (supabase) {
    const { error: logError } = await supabase.from("email_logs").insert({
      user_id: user.id,
      email: user.email,
      type: emailType,
      details: { ...details },
    });
    if (logError) console.error("Failed to log email to database:", logError);
  }
}
