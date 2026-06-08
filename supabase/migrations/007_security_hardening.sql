-- ============================================================================
-- 007_security_hardening.sql
--
-- Closes critical Row Level Security gaps found in the security review:
--   1. email_logs had RLS DISABLED → table was world-readable/writable via the
--      public anon key. Enable RLS.
--   2. profiles allowed users to UPDATE their own row with no column protection →
--      any user could set role='admin'/'pro' (privilege escalation + free Pro).
--      A trigger now forces privileged columns for all non-service-role writers.
--   3. profiles SELECT policy was USING (true) → every user's email + Stripe
--      customer id was readable by anyone. Restrict to "own row, or admin".
--   4. generate_referral_code() had a mutable search_path. Pin it.
--
-- ⚠️  DEPLOY ORDER MATTERS. Apply this ONLY AFTER the backend is redeployed with
--     SUPABASE_SERVICE_ROLE_KEY set. The backend (cron jobs, Stripe webhook,
--     email_logs, referral writes) must use the service role key so that these
--     tightened policies do not break those server-side flows.
-- ============================================================================

begin;

-- ── 0. Ensure privilege columns exist (idempotent; safe if 006 already ran) ──
-- The anti-escalation trigger below references pro_expires_at, which is added by
-- migration 006. Re-assert it here so 007 is self-sufficient in any order.
alter table public.profiles add column if not exists pro_expires_at timestamptz;

-- ── 1. Enable RLS on email_logs ────────────────────────────────────────────
alter table public.email_logs enable row level security;

-- Users may read their own logs directly (policy already exists). Inserts/writes
-- happen only from the trusted backend using the service role key, which bypasses
-- RLS — so no INSERT policy is granted to end users on purpose.
drop policy if exists "Users can view their own email logs" on public.email_logs;
create policy "Users can view their own email logs"
  on public.email_logs for select
  using (auth.uid() = user_id);

-- ── 2. Admin helper (SECURITY DEFINER avoids RLS recursion on profiles) ──────
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- ── 3. Lock down profiles SELECT (no more public-everyone read) ──────────────
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can view their own profile referral fields" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- ── 4. Recreate profile UPDATE policies (admins via helper; users own row) ───
drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update their own profile referral fields" on public.profiles;

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin());

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── 5. Prevent privilege-column tampering by non-service-role writers ────────
-- Even with the self-update policy above, a user could try to change role/status/
-- billing columns. This trigger forces those columns to safe values for anyone who
-- is NOT the trusted backend (service_role). The backend keeps full control.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted server-side code (service role) may set anything.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'user';
    new.status := 'active';
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.pro_expires_at := null;
    new.pro_months_earned := 0;
  elsif tg_op = 'UPDATE' then
    new.role := old.role;
    new.status := old.status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.pro_expires_at := old.pro_expires_at;
    new.pro_months_earned := old.pro_months_earned;
    new.referral_code := old.referral_code;  -- users can't mint their own code
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_columns on public.profiles;
create trigger trg_protect_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- ── 6. Pin search_path on the referral code generator ───────────────────────
-- (No-op if the signature differs; adjust the argument list to match your function.)
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'generate_referral_code'
  ) then
    execute 'alter function public.generate_referral_code() set search_path = public';
  end if;
exception when others then
  raise notice 'Could not set search_path on generate_referral_code (check its signature): %', sqlerrm;
end $$;

commit;

-- ── 7. One-time admin bootstrap (run manually, NOT part of the app) ──────────
-- Because clients can no longer self-assign admin, grant it explicitly once:
--   update public.profiles set role = 'admin' where email = 'jeratomise@gmail.com';
