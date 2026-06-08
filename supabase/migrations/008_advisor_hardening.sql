-- ============================================================================
-- 008_advisor_hardening.sql
--
-- Clears the SECURITY DEFINER advisor warnings introduced by migration 007.
-- PostgREST exposes only the `public` schema over /rest/v1/rpc, so moving the
-- is_admin() helper into a `private` schema removes its RPC exposure while RLS
-- policies keep using it. The privilege-protection trigger function has its direct
-- EXECUTE revoked (triggers fire regardless of caller EXECUTE).
--
-- ⚠️ Already applied to the live database via the Supabase API. This file is the
-- version-controlled record. It is idempotent and safe to re-run / `supabase db push`.
-- ============================================================================

create schema if not exists private;

create or replace function private.is_admin()
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

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- Repoint the policies that referenced public.is_admin() to private.is_admin()
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (private.is_admin());

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (private.is_admin());

-- Remove the public (RPC-exposed) copy now that nothing references it
drop function if exists public.is_admin();

-- Trigger functions don't need caller EXECUTE; revoke so it isn't RPC-callable
revoke all on function public.protect_profile_privileged_columns() from public, anon, authenticated;
