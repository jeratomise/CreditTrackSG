import { Bill, ExtractionCorrection, Transaction, TransactionKind } from '../types';

/** Line-item fields a user can correct on the review screen. */
export const REVIEW_FIELDS = ['date', 'description', 'merchant', 'category', 'kind', 'amount'] as const;
type ReviewField = typeof REVIEW_FIELDS[number];

const BILL_FIELDS = ['statementDate', 'dueDate', 'totalAmount', 'previousBalance'] as const;
type BillField = typeof BILL_FIELDS[number];

const CREDIT_KINDS: TransactionKind[] = ['refund', 'payment'];
const MAX_VALUE_LENGTH = 1000;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Refunds and payments reduce the balance, so they are stored negative. */
export function signedAmount(kind: TransactionKind | null | undefined, amount: number): number {
  return kind && CREDIT_KINDS.includes(kind) && amount > 0 ? -amount : amount;
}

const asText = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  return String(v).slice(0, MAX_VALUE_LENGTH);
};

const rowSummary = (t: Transaction) =>
  asText(JSON.stringify({ date: t.date, description: t.description, merchant: t.merchant, category: t.category, kind: t.kind, amount: t.amount }));

const same = (a: unknown, b: unknown) => (asText(a) ?? '') === (asText(b) ?? '');

export interface ReviewDiff {
  billPatch: Partial<Pick<Bill, BillField>>;
  updates: { id: string; patch: Partial<Pick<Transaction, ReviewField>> }[];
  inserts: Transaction[];
  deletes: string[];
  /** Corrections for added rows get their `transactionId` once the rows are inserted. */
  corrections: ExtractionCorrection[];
}

/**
 * Compares the bill as extracted with the bill after review. Rows in `edited`
 * without an id are new; original rows missing from `edited` were deleted.
 */
export function diffBillReview(original: Bill, edited: Bill): ReviewDiff {
  const billId = original.id;
  const corrections: ExtractionCorrection[] = [];
  const correction = (c: Omit<ExtractionCorrection, 'billId'>) => corrections.push({ billId, ...c });

  const billPatch: ReviewDiff['billPatch'] = {};
  for (const field of BILL_FIELDS) {
    if (!same(original[field], edited[field])) {
      (billPatch as Record<string, unknown>)[field] = edited[field];
      correction({ transactionId: null, action: 'edit', field, beforeValue: asText(original[field]), afterValue: asText(edited[field]) });
    }
  }

  const editedById = new Map(edited.transactions.filter(t => t.id).map(t => [t.id, t]));
  const updates: ReviewDiff['updates'] = [];
  const deletes: string[] = [];

  for (const before of original.transactions) {
    const after = editedById.get(before.id);
    if (!after) {
      deletes.push(before.id);
      correction({ transactionId: before.id, action: 'delete', field: null, beforeValue: rowSummary(before), afterValue: null });
      continue;
    }
    const patch: Record<string, unknown> = {};
    for (const field of REVIEW_FIELDS) {
      if (!same(before[field], after[field])) {
        patch[field] = after[field];
        correction({ transactionId: before.id, action: 'edit', field, beforeValue: asText(before[field]), afterValue: asText(after[field]) });
      }
    }
    if (Object.keys(patch).length > 0) updates.push({ id: before.id, patch });
  }

  const inserts = edited.transactions.filter(t => !t.id);
  for (const t of inserts) {
    correction({ transactionId: null, action: 'add', field: null, beforeValue: null, afterValue: rowSummary(t) });
  }

  return { billPatch, updates, inserts, deletes, corrections };
}
