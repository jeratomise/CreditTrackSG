// Server-side checks on AI-extracted bills. The AI's line items are only trusted
// when they add back up to the printed total and the dates fit a billing cycle.
// Line items are spend only: card repayments and balance rows never become transactions.
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

// Statement rows that are balances, not transactions.
const SUMMARY_ROW = /^\s*(previous|prev\.?|last statement|opening|new|closing)\s+balance\b|\bsub[\s-]?total\b|^\s*total\s+(balance|amount|due|for)\b/i;
// Card repayments: "PAYMT THRU E-BANK", "PAYMENT - THANK YOU", "GIRO PAYMENT". Only credits match,
// so a bill paid with the card (e.g. "AXS PAYMENT", a charge) stays a purchase.
const REPAYMENT_TEXT = /\bpaym(en)?t\b|\bthank\s*you\b/i;

function normaliseTransaction(t: ParsedTransaction): ParsedTransaction {
  const amount = Number(t.amount) || 0;
  let kind: TransactionKind =
    t.kind && TRANSACTION_KINDS.includes(t.kind) ? t.kind : amount < 0 ? "refund" : "purchase";
  const isCredit = amount < 0 || CREDIT_KINDS.includes(kind);
  if (kind !== "payment" && isCredit && REPAYMENT_TEXT.test(t.description ?? "")) kind = "payment";
  // Models sometimes print credits as positive "CR" amounts; credits must reduce the balance.
  const signed = CREDIT_KINDS.includes(kind) && amount > 0 ? -amount : amount;
  return { ...t, amount: signed, kind };
}

/**
 * Payments to the card are not spend, so they are dropped from the line items and
 * kept only as a bill-level total for the reconciliation.
 */
function splitPayments(bill: ParsedBillData) {
  const lines = (bill.transactions || [])
    .filter(t => !SUMMARY_ROW.test(t.description ?? ""))
    .map(normaliseTransaction);
  const paymentLines = lines.filter(t => t.kind === "payment");
  const fromLines = round2(paymentLines.reduce((sum, t) => sum + Math.abs(t.amount), 0));
  const reported = Math.abs(Number(bill.paymentsReceived) || 0);
  return {
    transactions: lines.filter(t => t.kind !== "payment"),
    // If the model both listed the payments and totalled them, they are the same payments.
    paymentsReceived: reported > 0 ? reported : fromLines,
  };
}

/**
 * Amount due = previous balance − payments + new lines. When the last bill was paid in
 * full the first two cancel, and many statements' card totals list new lines only, so a
 * bill also reconciles if its lines alone add up to the printed total.
 */
function reconcile(printedTotal: number, lineSum: number, previousBalance: number, paymentsReceived: number) {
  const matches = (carried: number) =>
    Number.isFinite(printedTotal) && Math.abs(round2(carried + lineSum) - printedTotal) <= TOTALS_TOLERANCE;
  const fullCarried = round2(previousBalance - paymentsReceived);
  const carriedBalance = matches(fullCarried) ? fullCarried : matches(0) ? 0 : fullCarried;
  return { carriedBalance, extractedTotal: round2(carriedBalance + lineSum), totalsMatch: matches(carriedBalance) };
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
  const { transactions: lines, paymentsReceived } = splitPayments(bill);
  const lineSum = lines.reduce((sum, t) => sum + t.amount, 0);
  const previousBalance = Number(bill.previousBalance) || 0;
  const { carriedBalance, extractedTotal, totalsMatch } =
    reconcile(Number(bill.totalAmount), lineSum, previousBalance, paymentsReceived);
  const { dueDate, transactions, datesOk } = checkDates(bill, lines, today);
  return {
    ...bill,
    dueDate,
    transactions,
    previousBalance,
    paymentsReceived,
    checks: { extractedTotal, totalsMatch, datesOk, carriedBalance },
  };
}

/** Drop payments, normalise line items, repair date years, and reconcile each bill against its printed total. */
export function checkExtraction(result: AIExtractionResponse, today = todayInSingapore()): AIExtractionResponse {
  const todayDate = parseIsoDay(today) ?? new Date();
  return { ...result, bills: (result.bills || []).map(b => checkBill(b, todayDate)) };
}
