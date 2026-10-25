-- ============================================================================
-- 011_bill_review.sql
--
-- Review screen: each user checks and corrects the line items the AI extracted
-- from their own statements, then confirms the statement.
--
-- 1. transactions: owners can now UPDATE and DELETE line items on their own bills
--    (previously INSERT/SELECT only). Same ownership test as the existing policies.
-- 2. bills.reviewed_at: when the user confirmed the statement.
--    bills.previous_balance: the carried-in balance included in total_amount, so
--    total_amount = previous_balance + sum(line items) can be re-checked after edits.
-- 3. extraction_corrections: one row per change a user makes during review
--    (field, before, after, plus the bank and AI model that produced the original).
--    This is the training signal for merchant learning and the accuracy dashboard.
--    Users insert and read only their own rows; rows go when the bill is deleted.
--
-- Idempotent.
-- ============================================================================

begin;

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
  for update to authenticated
  using (exists (select 1 from public.bills b where b.id = transactions.bill_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.bills b where b.id = transactions.bill_id and b.user_id = (select auth.uid())));

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions
  for delete to authenticated
  using (exists (select 1 from public.bills b where b.id = transactions.bill_id and b.user_id = (select auth.uid())));

alter table public.bills
  add column if not exists reviewed_at timestamptz,
  add column if not exists previous_balance numeric;

create table if not exists public.extraction_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  -- No foreign key: a deleted line item keeps its correction row.
  transaction_id uuid,
  action text not null check (action in ('edit', 'add', 'delete')),
  field text check (field is null or length(field) <= 40),
  before_value text check (before_value is null or length(before_value) <= 1000),
  after_value text check (after_value is null or length(after_value) <= 1000),
  bank_name text,
  provider text,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists extraction_corrections_user_idx on public.extraction_corrections (user_id, created_at desc);
create index if not exists extraction_corrections_bill_idx on public.extraction_corrections (bill_id);

alter table public.extraction_corrections enable row level security;

revoke all on public.extraction_corrections from anon, authenticated;
grant select, insert on public.extraction_corrections to authenticated;

drop policy if exists "corrections_select_own" on public.extraction_corrections;
create policy "corrections_select_own" on public.extraction_corrections
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "corrections_insert_own" on public.extraction_corrections;
create policy "corrections_insert_own" on public.extraction_corrections
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.bills b where b.id = extraction_corrections.bill_id and b.user_id = (select auth.uid()))
  );

commit;
