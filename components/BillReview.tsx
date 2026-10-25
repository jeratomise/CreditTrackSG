import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, FileText, Plus, Trash2 } from 'lucide-react';
import { Bill, Transaction, TransactionKind } from '../types';
import { dbService } from '../services/dbService';
import { round2, signedAmount } from '../services/reviewDiff';
import { fieldClass, labelClass, primaryButtonClass, ghostButtonClass } from './formStyles';

const KIND_LABELS: Record<TransactionKind, string> = {
  purchase: 'Purchase',
  refund: 'Refund',
  fee: 'Fee',
  interest: 'Interest',
  payment: 'Payment',
  instalment: 'Instalment',
  other: 'Other',
};

const DEFAULT_CATEGORIES = [
  'Dining', 'Groceries', 'Shopping', 'Online', 'Travel', 'Transport',
  'Utilities', 'Entertainment', 'Health', 'Insurance', 'Education', 'Others',
];

// Matches the server's totals check (api/_lib/billChecks.ts).
const TOTALS_TOLERANCE = 0.05;

const cellClass = fieldClass.replace('py-3', 'py-2').replace('min-h-[48px]', 'min-h-[44px]');

const money = (n: number): string =>
  n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface RowDraft {
  key: string;
  id: string; // '' for a row added during review
  original?: Transaction;
  date: string;
  description: string;
  merchant: string;
  category: string;
  kind: TransactionKind | '';
  amount: string;
}

const toDraft = (t: Transaction): RowDraft => ({
  key: t.id,
  id: t.id,
  original: t,
  date: t.date ?? '',
  description: t.description ?? '',
  merchant: t.merchant ?? '',
  category: t.category ?? '',
  kind: t.kind ?? '',
  amount: String(t.amount ?? ''),
});

const parseAmount = (s: string): number | null => {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const sumAmounts = (rows: { amount: number }[]) => round2(rows.reduce((s, r) => s + r.amount, 0));

interface BillReviewProps {
  bill: Bill;
  position: { index: number; total: number };
  knownCategories: string[];
  onConfirm: (original: Bill, edited: Bill) => Promise<void>;
  onSkip: () => void;
}

/**
 * Lets a user check the AI's line items against their statement, correct them,
 * and confirm. Every change is diffed against `baseline` and logged as a correction.
 */
export const BillReview: React.FC<BillReviewProps> = ({ bill, position, knownCategories, onConfirm, onSkip }) => {
  // Bills saved before previous_balance existed: recover it from the server's reconciled total.
  const baseline = useMemo<Bill>(() => {
    const carried = bill.previousBalance
      ?? (bill.extractedTotal != null ? round2(bill.extractedTotal - sumAmounts(bill.transactions)) : 0);
    return { ...bill, previousBalance: carried };
  }, [bill]);

  const [rows, setRows] = useState<RowDraft[]>(() => bill.transactions.map(toDraft));
  const [statementDate, setStatementDate] = useState(bill.statementDate ?? '');
  const [dueDate, setDueDate] = useState(bill.dueDate ?? '');
  const [totalAmount, setTotalAmount] = useState(String(bill.totalAmount ?? ''));
  const [previousBalance, setPreviousBalance] = useState(String(baseline.previousBalance ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMismatch, setConfirmMismatch] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set([...knownCategories, ...DEFAULT_CATEGORIES].filter(Boolean))).sort(),
    [knownCategories]
  );

  const printed = parseAmount(totalAmount);
  const carried = parseAmount(previousBalance) ?? 0;
  const lineSum = round2(rows.reduce((s, r) => s + signedAmount(r.kind || null, parseAmount(r.amount) ?? 0), 0));
  const reconciled = round2(carried + lineSum);
  const difference = printed === null ? null : round2(reconciled - printed);
  const totalsMatch = difference !== null && Math.abs(difference) <= TOTALS_TOLERANCE;

  const updateRow = (key: string, patch: Partial<RowDraft>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
    setConfirmMismatch(false);
  };

  const addRow = () => {
    setRows(prev => [...prev, {
      key: `new-${crypto.randomUUID()}`,
      id: '',
      date: statementDate,
      description: '',
      merchant: '',
      category: '',
      kind: 'purchase',
      amount: '',
    }]);
  };

  const removeRow = (key: string) => {
    setRows(prev => prev.filter(r => r.key !== key));
    setConfirmMismatch(false);
  };

  const validationError = (): string | null => {
    if (!statementDate || !dueDate) return 'Statement date and due date are required.';
    if (printed === null) return 'Enter the total shown on the statement.';
    for (const [i, r] of rows.entries()) {
      if (!r.date) return `Line ${i + 1} needs a date.`;
      if (parseAmount(r.amount) === null) return `Line ${i + 1} needs an amount.`;
      if (!r.id && !r.merchant.trim() && !r.description.trim()) return `Line ${i + 1} needs a merchant.`;
    }
    return null;
  };

  const buildEdited = (): Bill => ({
    ...baseline,
    statementDate,
    dueDate,
    totalAmount: printed ?? baseline.totalAmount,
    previousBalance: carried,
    transactions: rows.map(r => {
      const kind = r.kind || null;
      const merchant = r.merchant.trim();
      return {
        ...(r.original ?? {}),
        id: r.id,
        date: r.date,
        description: r.id ? r.original?.description ?? '' : r.description.trim() || merchant,
        merchant: merchant || null,
        category: r.category.trim() || (r.id ? r.original?.category ?? '' : 'Others'),
        kind,
        amount: signedAmount(kind, parseAmount(r.amount) ?? 0),
      };
    }),
  });

  const handleConfirm = async () => {
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!totalsMatch && !confirmMismatch) {
      setConfirmMismatch(true);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(baseline, buildEdited());
    } catch (e) {
      console.error('Review save failed', e);
      setError('Could not save your review. Check your connection and try again.');
      setSaving(false);
    }
  };

  const handleViewStatement = async () => {
    if (!bill.filePath) return;
    const url = await dbService.getBillFileUrl(bill.filePath);
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-2">
            Review · card <span className="tabular-nums">{position.index + 1}</span> of <span className="tabular-nums">{position.total}</span>
          </p>
          <h1 className="text-2xl font-medium tracking-tight-display text-ink truncate">{bill.cardName}</h1>
          <p className="text-ink-mute text-sm mt-1">
            {bill.bankName}. Check each line against your statement, fix anything wrong, then confirm.
          </p>
        </div>
        {bill.filePath && (
          <button onClick={handleViewStatement} className={`${ghostButtonClass} flex items-center gap-2 border border-brass-500/20`}>
            <FileText className="w-4 h-4" strokeWidth={1.5} />
            View statement
          </button>
        )}
      </header>

      {bill.reviewStatus === 'needs_review' && (
        <div className="flex items-start gap-3 border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-ink-soft">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
          <p>The lines the AI read didn't add up to the printed total, or a date looked wrong. Look for missing, duplicated or mis-signed lines.</p>
        </div>
      )}

      <section className="bg-marine-900 border border-brass-500/15 p-4 sm:p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={labelClass} htmlFor="review-statement-date">Statement date</label>
            <input id="review-statement-date" type="date" className={fieldClass} value={statementDate}
              onChange={e => setStatementDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="review-due-date">Due date</label>
            <input id="review-due-date" type="date" className={fieldClass} value={dueDate}
              onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="review-total">Printed total (S$)</label>
            <input id="review-total" inputMode="decimal" className={`${fieldClass} font-mono tabular-nums`} value={totalAmount}
              onChange={e => { setTotalAmount(e.target.value); setConfirmMismatch(false); }} />
          </div>
          <div>
            <label className={labelClass} htmlFor="review-previous">Previous balance (S$)</label>
            <input id="review-previous" inputMode="decimal" className={`${fieldClass} font-mono tabular-nums`} value={previousBalance}
              onChange={e => { setPreviousBalance(e.target.value); setConfirmMismatch(false); }} />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-brass-500/10 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-ink-soft">
            Previous balance <span className="font-mono tabular-nums text-ink">{money(carried)}</span>
            {' + '}lines <span className="font-mono tabular-nums text-ink">{money(lineSum)}</span>
            {' = '}<span className="font-mono tabular-nums text-ink">{money(reconciled)}</span>
          </p>
          {totalsMatch ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 border text-success border-success/40">
              <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              Adds up
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 border text-warning border-warning/40">
              <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
              {difference === null ? 'Enter the total' : `Off by S$${money(Math.abs(difference))}`}
            </span>
          )}
        </div>
      </section>

      <section className="bg-marine-900 border border-brass-500/15">
        <div className="hidden md:grid md:grid-cols-[9.5rem_minmax(0,1fr)_9rem_8rem_7.5rem_2.75rem] gap-3 px-4 py-3 border-b border-brass-500/15 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          <span>Date</span>
          <span>Merchant</span>
          <span>Category</span>
          <span>Type</span>
          <span className="text-right">Amount (S$)</span>
          <span />
        </div>

        <datalist id="review-categories">
          {categories.map(c => <option key={c} value={c} />)}
        </datalist>

        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-mute">No lines. Add the transactions from your statement.</p>
        )}

        <ul className="divide-y divide-brass-500/10">
          {rows.map((r, i) => (
            <li key={r.key} className="grid grid-cols-2 md:grid-cols-[9.5rem_minmax(0,1fr)_9rem_8rem_7.5rem_2.75rem] gap-3 px-4 py-3 items-start">
              <input type="date" aria-label={`Line ${i + 1} date`} className={cellClass} value={r.date}
                onChange={e => updateRow(r.key, { date: e.target.value })} />
              <div className="col-span-2 md:col-span-1 md:order-none order-first min-w-0">
                <input aria-label={`Line ${i + 1} merchant`} className={cellClass} value={r.merchant} placeholder="Merchant"
                  onChange={e => updateRow(r.key, { merchant: e.target.value })} />
                {r.id ? (
                  <p className="mt-1 text-[11px] text-ink-mute truncate" title={r.description}>{r.description}</p>
                ) : (
                  <input aria-label={`Line ${i + 1} statement text`} className={`${cellClass} mt-2`} value={r.description}
                    placeholder="Statement text (optional)" onChange={e => updateRow(r.key, { description: e.target.value })} />
                )}
              </div>
              <input list="review-categories" aria-label={`Line ${i + 1} category`} className={cellClass} value={r.category}
                placeholder="Category" onChange={e => updateRow(r.key, { category: e.target.value })} />
              <select aria-label={`Line ${i + 1} type`} className={cellClass} value={r.kind}
                onChange={e => updateRow(r.key, { kind: e.target.value as TransactionKind | '' })}>
                {!r.kind && <option value="">—</option>}
                {(Object.keys(KIND_LABELS) as TransactionKind[]).map(k => (
                  <option key={k} value={k}>{KIND_LABELS[k]}</option>
                ))}
              </select>
              <input inputMode="decimal" aria-label={`Line ${i + 1} amount`} className={`${cellClass} font-mono tabular-nums text-right`}
                value={r.amount} onChange={e => updateRow(r.key, { amount: e.target.value })} />
              <button onClick={() => removeRow(r.key)} aria-label={`Delete line ${i + 1}`}
                className="w-11 h-11 flex items-center justify-center text-ink-mute hover:text-danger transition-colors duration-150 justify-self-end">
                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>

        <div className="px-4 py-3 border-t border-brass-500/10 flex flex-wrap items-center justify-between gap-3">
          <button onClick={addRow} className={`${ghostButtonClass} flex items-center gap-2 px-0`}>
            <Plus className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
            Add a line
          </button>
          <p className="text-xs text-ink-mute">Refunds and payments are saved as negative amounts.</p>
        </div>
      </section>

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {confirmMismatch && !error && (
        <p className="text-sm text-warning" role="alert">
          The lines are still off by S${money(Math.abs(difference ?? 0))}. Confirm anyway if your statement has lines that can't be listed.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 pb-4">
        <button onClick={onSkip} disabled={saving} className={ghostButtonClass}>
          Skip for now
        </button>
        <button onClick={handleConfirm} disabled={saving} className={`${primaryButtonClass} disabled:opacity-60`}>
          <CheckCircle className="w-4 h-4" strokeWidth={1.5} />
          {saving ? 'Saving' : confirmMismatch ? 'Confirm anyway' : 'Confirm statement'}
        </button>
      </div>
    </div>
  );
};
