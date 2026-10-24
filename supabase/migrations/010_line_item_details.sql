-- ============================================================================
-- 010_line_item_details.sql
--
-- Richer line items and an automatic totals check on every extracted bill.
--
-- transactions: `description` keeps the statement text exactly as printed; the new
-- `merchant` is the cleaned name used for merchant-level spend analysis. Amounts
-- are SGD, positive for charges and negative for credits (refunds, payments).
--
-- bills: which AI provider/model read the statement, the line-item sum the server
-- reconciled (previous balance + line items), whether it matched the printed
-- total, and a review status for the human confirmation step that comes next.
--
-- Columns only. Existing RLS policies on bills/transactions already cover them.
-- Rows created before this migration keep NULL in every new column. Idempotent.
-- ============================================================================

begin;

alter table public.transactions
  add column if not exists merchant text,
  add column if not exists kind text,
  add column if not exists currency text,
  add column if not exists foreign_amount numeric;

alter table public.bills
  add column if not exists extraction_provider text,
  add column if not exists extraction_model text,
  add column if not exists extracted_total numeric,
  add column if not exists totals_match boolean,
  add column if not exists review_status text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_kind_check') then
    alter table public.transactions add constraint transactions_kind_check
      check (kind is null or kind in ('purchase', 'refund', 'fee', 'interest', 'payment', 'instalment', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bills_review_status_check') then
    alter table public.bills add constraint bills_review_status_check
      check (review_status is null or review_status in ('auto_verified', 'needs_review', 'confirmed'));
  end if;
end $$;

commit;
