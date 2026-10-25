
export enum CardType {
  UOB_LADYS = 'UOB Lady\'s Card',
  CITI_REWARDS = 'Citi Rewards',
  DBS_WWMC = 'DBS Woman\'s World',
  UOB_VISA_SIGNATURE = 'UOB Visa Signature',
  HSBC_REVOLUTION = 'HSBC Revolution',
  DBS_LIVE_FRESH = 'DBS Live Fresh',
  GENERIC = 'Generic Card'
}

export interface User {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  role: 'admin' | 'user' | 'pro';
  status: 'active' | 'suspended' | 'pending';
  // True when the user has signed up but hasn't completed activation (no profile
  // row yet — i.e. not confirmed/logged in). Only populated by the admin users API.
  pending?: boolean;
}

export interface SystemConfig {
  allowSignups: boolean;
  landingPage: {
    heroTitle: string;
    heroSubtitle: string;
    logoUrl?: string; // Optional custom logo URL
    bullets: string[];
  }
}

/** Shared by the browser and the backend (api/_lib/aiConfig.ts). */
export type AiProvider = 'gemini' | 'openrouter';

export interface AiModelConfig {
  provider: AiProvider;
  model: string;
}

/** Admin view of AI settings. `active` differs from `config` when the saved provider's key is missing. */
export interface AiSettings {
  config: AiModelConfig;
  active: AiModelConfig;
  defaults: AiModelConfig;
  suggestions: Record<AiProvider, string[]>;
  keys: Record<AiProvider, boolean>;
}

/** Credits (refund, payment) carry negative amounts; every other kind is a charge. */
export type TransactionKind = 'purchase' | 'refund' | 'fee' | 'interest' | 'payment' | 'instalment' | 'other';

/** auto_verified: line items reconciled to the printed total. confirmed: a person checked it. */
export type ReviewStatus = 'auto_verified' | 'needs_review' | 'confirmed';

export interface Transaction {
  id: string;
  date: string;
  description: string; // Statement text exactly as printed
  amount: number; // SGD; negative for refunds and payments
  category: string;
  merchant?: string | null;
  kind?: TransactionKind | null;
  currency?: string | null; // Foreign-currency spend only
  foreignAmount?: number | null;
  originalCategory?: string;
  suggestedCard?: string; // Recommendation from AI
  isOptimizationMissed?: boolean;
}

export interface PaymentDetails {
  paidAt: string;
  transactionId: string;
  method: 'Online' | 'Giro' | 'Mobile' | 'Other';
}

export interface Bill {
  id: string;
  bankName: string;
  cardName: string;
  statementDate: string;
  dueDate: string;
  totalAmount: number;
  isPaid: boolean;
  paymentDetails?: PaymentDetails;
  transactions: Transaction[];
  uploadedAt: string;
  filePath?: string | null; // Path to Supabase Storage
  riskScore: number; // 0-100
  reminderEmailId?: string | null; // Resend scheduled email ID for cancellation
  extractionProvider?: AiProvider | null;
  extractionModel?: string | null;
  previousBalance?: number | null; // Carried-in balance included in totalAmount
  extractedTotal?: number | null; // Previous balance + line items, as reconciled by the server
  totalsMatch?: boolean | null;
  reviewStatus?: ReviewStatus | null;
  reviewedAt?: string | null;
}

/** One change a user made while reviewing a statement (`extraction_corrections`). */
export interface ExtractionCorrection {
  billId: string;
  transactionId: string | null;
  action: 'edit' | 'add' | 'delete';
  field: string | null;
  beforeValue: string | null;
  afterValue: string | null;
}

export interface SpendAnalysis {
  totalSpend: number;
  categoryBreakdown: { name: string; value: number }[];
  monthlyTrend: { month: string; amount: number }[];
  missedMilesOpportunity: number; // Estimated miles lost
}

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  merchant?: string;
  kind?: TransactionKind;
  currency?: string;
  foreignAmount?: number;
}

export interface BillChecks {
  extractedTotal: number;
  totalsMatch: boolean;
  datesOk: boolean; // Statement is recent and due/line-item dates fit its billing cycle
}

export interface ParsedBillData {
  bankName: string;
  cardName: string;
  totalAmount: number;
  previousBalance?: number;
  dueDate: string;
  statementDate: string;
  transactions: ParsedTransaction[];
  checks?: BillChecks; // Added by the server, not the AI
}

export interface AIExtractionResponse {
  bills: ParsedBillData[];
  extraction?: AiModelConfig; // Provider and model that read the statement
}

export interface UserSettings {
  email: string;
  notificationFrequency: '6hours' | 'daily' | 'weekly';
  reminderEnabled: boolean;
}

export interface EmailLog {
  id: string;
  user_id: string;
  email: string;
  type: string;
  sent_at: string;
  details: any;
}

// Referral types
export type ReferralStatus = 'pending' | 'converted' | 'rewarded';

export interface Referral {
  id: string;
  referrerId: string;
  refereeId: string;
  referralCodeUsed: string;
  status: ReferralStatus;
  createdAt: string;
  convertedAt?: string;
}

export interface ReferralStats {
  total: number;
  pending: number;
  converted: number;
  rewarded: number;
  referralCode: string;
  referralUrl: string;
  proMonthsEarned: number;
}
