// Server-side reconciliation of AI-extracted bills. The AI's line items are only
// trusted when they add back up to the total printed on the statement.
import type { AIExtractionResponse, ParsedBillData, ParsedTransaction, TransactionKind } from "../../types";

export const TRANSACTION_KINDS: readonly TransactionKind[] = [
  "purchase",
  "refund",
  "fee",
  "interest",
  "payment",
  "instalment",
  "other",
];

const CREDIT_KINDS: readonly TransactionKind[] = ["refund", "payment"];

// Statement totals are printed to the cent; this absorbs rounding across many lines.
export const TOTALS_TOLERANCE = 0.05;

const round2 = (n: number) => Math.round(n * 100) / 100;

function normaliseTransaction(t: ParsedTransaction): ParsedTransaction {
  const amount = Number(t.amount) || 0;
  const kind: TransactionKind =
    t.kind && TRANSACTION_KINDS.includes(t.kind) ? t.kind : amount < 0 ? "refund" : "purchase";
  // Models sometimes print credits as positive "CR" amounts; credits must reduce the balance.
  const signed = CREDIT_KINDS.includes(kind) && amount > 0 ? -amount : amount;
  return { ...t, amount: signed, kind };
}

function checkBill(bill: ParsedBillData): ParsedBillData {
  const transactions = (bill.transactions || []).map(normaliseTransaction);
  const lineItemSum = transactions.reduce((sum, t) => sum + t.amount, 0);
  const extractedTotal = round2((Number(bill.previousBalance) || 0) + lineItemSum);
  const printedTotal = Number(bill.totalAmount);
  const totalsMatch = Number.isFinite(printedTotal) && Math.abs(extractedTotal - printedTotal) <= TOTALS_TOLERANCE;
  return { ...bill, transactions, checks: { extractedTotal, totalsMatch } };
}

/** Normalise line-item signs and reconcile each bill against its printed total. */
export function checkExtraction(result: AIExtractionResponse): AIExtractionResponse {
  return { ...result, bills: (result.bills || []).map(checkBill) };
}
