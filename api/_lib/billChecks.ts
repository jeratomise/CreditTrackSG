// Server-side checks on AI-extracted bills. The AI's line items are only trusted
// when they add back up to the printed total and the dates fit a billing cycle.
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

// Billing-cycle windows, in days relative to the statement date. Singapore cards are
// usually due 20–25 days after the statement; line items post within the cycle,
// with some late-posted or instalment lines going back further.
const DUE_WINDOW = { min: 0, max: 60 };
const LINE_ITEM_WINDOW = { min: -120, max: 31 };
// Older statements can be uploaded, but a date this old is more likely a wrong year.
const MAX_STATEMENT_AGE_DAYS = 550;

const DAY_MS = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysFrom = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** Today's date in Singapore as YYYY-MM-DD. */
export function todayInSingapore(now = new Date()): string {
  return isoDay(new Date(now.getTime() + 8 * 3_600_000));
}

function parseIsoDay(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return !isNaN(d.getTime()) && isoDay(d) === value ? d : null;
}

/**
 * Keeps the day and month of `date` and picks the year that puts it inside `window`
 * days of `anchor`. Returns null when no year fits, or more than one does.
 */
function fitYear(date: Date, anchor: Date, window: { min: number; max: number }): Date | null {
  const fits = (d: Date) => {
    const gap = daysFrom(anchor, d);
    return gap >= window.min && gap <= window.max;
  };
  if (fits(date)) return date;
  const year = anchor.getUTCFullYear();
  const candidates = [year - 1, year, year + 1]
    .map(y => parseIsoDay(`${y}${isoDay(date).slice(4)}`))
    .filter((d): d is Date => d !== null && fits(d));
  return candidates.length === 1 ? candidates[0] : null;
}

function normaliseTransaction(t: ParsedTransaction): ParsedTransaction {
  const amount = Number(t.amount) || 0;
  const kind: TransactionKind =
    t.kind && TRANSACTION_KINDS.includes(t.kind) ? t.kind : amount < 0 ? "refund" : "purchase";
  // Models sometimes print credits as positive "CR" amounts; credits must reduce the balance.
  const signed = CREDIT_KINDS.includes(kind) && amount > 0 ? -amount : amount;
  return { ...t, amount: signed, kind };
}

/**
 * Repairs due-date and line-item years against the statement date (statements often
 * omit the year on line items, and models guess it). The statement date itself is
 * never changed, only flagged, because a genuinely old statement is possible.
 */
function checkDates(bill: ParsedBillData, transactions: ParsedTransaction[], today: Date) {
  const statement = parseIsoDay(bill.statementDate);
  if (!statement) return { dueDate: bill.dueDate, transactions, datesOk: false };

  const age = daysFrom(statement, today);
  let datesOk = age >= -1 && age <= MAX_STATEMENT_AGE_DAYS;

  const parsedDue = parseIsoDay(bill.dueDate);
  const due = parsedDue && fitYear(parsedDue, statement, DUE_WINDOW);
  if (!due) datesOk = false;

  const fixedTransactions = transactions.map(t => {
    const parsed = parseIsoDay(t.date);
    const fixed = parsed && fitYear(parsed, statement, LINE_ITEM_WINDOW);
    if (!fixed) {
      datesOk = false;
      return t;
    }
    return { ...t, date: isoDay(fixed) };
  });

  return { dueDate: due ? isoDay(due) : bill.dueDate, transactions: fixedTransactions, datesOk };
}

function checkBill(bill: ParsedBillData, today: Date): ParsedBillData {
  const signed = (bill.transactions || []).map(normaliseTransaction);
  const lineItemSum = signed.reduce((sum, t) => sum + t.amount, 0);
  const extractedTotal = round2((Number(bill.previousBalance) || 0) + lineItemSum);
  const printedTotal = Number(bill.totalAmount);
  const totalsMatch = Number.isFinite(printedTotal) && Math.abs(extractedTotal - printedTotal) <= TOTALS_TOLERANCE;
  const { dueDate, transactions, datesOk } = checkDates(bill, signed, today);
  return { ...bill, dueDate, transactions, checks: { extractedTotal, totalsMatch, datesOk } };
}

/** Normalise line items, repair date years, and reconcile each bill against its printed total. */
export function checkExtraction(result: AIExtractionResponse, today = todayInSingapore()): AIExtractionResponse {
  const todayDate = parseIsoDay(today) ?? new Date();
  return { ...result, bills: (result.bills || []).map(b => checkBill(b, todayDate)) };
}
