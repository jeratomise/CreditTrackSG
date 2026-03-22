
import { supabase } from '../lib/supabaseClient';
import { Bill, Transaction, SystemConfig, PaymentDetails, User } from '../types';

export const dbService = {
  // --- Bills ---
  async getBills(userId: string): Promise<Bill[]> {
    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        transactions (*)
      `)
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    if (error) throw error;

    return (data || []).map((b: any) => ({
      id: b.id,
      bankName: b.bank_name,
      cardName: b.card_name,
      statementDate: b.statement_date,
      dueDate: b.due_date,
      totalAmount: b.total_amount,
      isPaid: b.is_paid,
      uploadedAt: b.created_at,
      riskScore: b.risk_score,
      filePath: b.file_path,
      reminderEmailId: b.reminder_email_id,
      paymentDetails: b.is_paid ? {
        paidAt: b.payment_date,
        transactionId: b.transaction_ref,
        method: b.payment_method as any
      } : undefined,
      transactions: (b.transactions || []).map((t: any) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        suggestedCard: t.suggested_card
      }))
    }));
  },

  async uploadBillDocument(file: File, userId: string): Promise<string> {
      const fileExt = file.name.split('.').pop();
      // Sanitize file name mostly to avoid special char issues in URL
      const fileName = `${userId}/${Date.now()}_${crypto.randomUUID().slice(0,8)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('bill-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      return fileName;
  },

  async createBill(bill: Bill, userId: string, fileOrPath?: File | string): Promise<Bill> {
    let filePath: string | null = null;

    // Handle File Upload or File Path
    if (fileOrPath) {
        if (typeof fileOrPath === 'string') {
            // Already uploaded, just link it
            filePath = fileOrPath;
        } else if (fileOrPath instanceof File) {
            // Need to upload
            try {
                filePath = await this.uploadBillDocument(fileOrPath, userId);
            } catch (err) {
                console.error("Auto-upload in createBill failed:", err);
                // Continue without file linkage if upload fails
            }
        }
    }

    // 2. Insert Bill
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .insert({
        user_id: userId,
        bank_name: bill.bankName,
        card_name: bill.cardName,
        statement_date: bill.statementDate,
        due_date: bill.dueDate,
        total_amount: bill.totalAmount,
        is_paid: bill.isPaid,
        file_path: filePath,
        risk_score: bill.riskScore
      })
      .select()
      .single();

    if (billError) {
        // Handle Missing Profile Constraint Error specifically
        if (billError.code === '23503') {
            throw new Error("Your user profile is desynchronized. Please REFRESH the page to automatically fix your account, then try uploading again.");
        }
        throw billError;
    }

    // 3. Insert Transactions
    if (bill.transactions.length > 0) {
      const transactionsPayload = bill.transactions.map(t => ({
        bill_id: billData.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        suggested_card: t.suggestedCard
      }));

      const { error: txError } = await supabase
        .from('transactions')
        .insert(transactionsPayload);

      if (txError) throw txError;
    }

    return { ...bill, id: billData.id, filePath };
  },

  async updateBill(bill: Bill): Promise<void> {
    const { error } = await supabase
      .from('bills')
      .update({
        bank_name: bill.bankName,
        card_name: bill.cardName,
        total_amount: bill.totalAmount,
        due_date: bill.dueDate,
        statement_date: bill.statementDate,
        is_paid: bill.isPaid,
        payment_date: bill.paymentDetails?.paidAt,
        payment_method: bill.paymentDetails?.method,
        transaction_ref: bill.paymentDetails?.transactionId
      })
      .eq('id', bill.id);

    if (error) throw error;
  },

  async deleteBill(billId: string): Promise<void> {
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', billId);

    if (error) throw error;
  },

  async getBillFileUrl(filePath: string): Promise<string | null> {
    if (!filePath) return null;

    // Create a signed URL valid for 1 hour
    const { data, error } = await supabase.storage
      .from('bill-documents')
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }

    return data.signedUrl;
  },

  // --- System Config ---
  async getSystemConfig(): Promise<SystemConfig | null> {
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .single();

    if (error) return null;

    return {
      allowSignups: data.allow_signups,
      landingPage: {
        heroTitle: data.hero_title,
        heroSubtitle: data.hero_subtitle,
        bullets: data.bullets || []
      }
    };
  },

  async updateSystemConfig(config: SystemConfig): Promise<void> {
    const { error } = await supabase
      .from('system_config')
      .update({
        allow_signups: config.allowSignups,
        hero_title: config.landingPage.heroTitle,
        hero_subtitle: config.landingPage.heroSubtitle,
        bullets: config.landingPage.bullets
      })
      .eq('id', 1);

    if (error) throw error;
  },

  // --- AI Insights (Supabase-backed cache) ---

  async getInsights(userId: string): Promise<{ insights: any; billsSignature: string; updatedAt: string } | null> {
    const { data, error } = await supabase
      .from('ai_insights')
      .select('insights, bills_signature, updated_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return {
      insights: data.insights,
      billsSignature: data.bills_signature,
      updatedAt: data.updated_at,
    };
  },

  async saveInsights(userId: string, insights: any, billsSignature: string): Promise<void> {
    const { error } = await supabase
      .from('ai_insights')
      .upsert({
        user_id: userId,
        insights,
        bills_signature: billsSignature,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  },

  // --- Trigger-based Email Reminders ---

  // Call after a bill is created to schedule a Resend email 3 days before due date
  async scheduleReminder(bill: Bill, user: User): Promise<void> {
    try {
      const response = await fetch('/api/schedule-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          userName: user.name,
          cardName: bill.cardName,
          bankName: bill.bankName,
          amount: bill.totalAmount,
          dueDate: bill.dueDate,
          userId: user.id,
          billId: bill.id,
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.warn("Failed to schedule reminder:", err);
      }
    } catch (err) {
      // Non-fatal — reminder scheduling should never block the main flow
      console.warn("Could not schedule email reminder:", err);
    }
  },

  // Call when a bill is marked as paid to cancel the pending Resend reminder
  async cancelReminder(reminderEmailId: string): Promise<void> {
    try {
      await fetch('/api/cancel-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderEmailId })
      });
    } catch (err) {
      console.warn("Could not cancel reminder:", err);
    }
  },
};
