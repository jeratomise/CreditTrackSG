
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
  status: 'active' | 'suspended';
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

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
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
}

export interface SpendAnalysis {
  totalSpend: number;
  categoryBreakdown: { name: string; value: number }[];
  monthlyTrend: { month: string; amount: number }[];
  missedMilesOpportunity: number; // Estimated miles lost
}

export interface ParsedBillData {
  bankName: string;
  cardName: string;
  totalAmount: number;
  dueDate: string;
  statementDate: string;
  transactions: {
    date: string;
    description: string;
    amount: number;
    category: string;
  }[];
}

export interface AIExtractionResponse {
  bills: ParsedBillData[];
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
