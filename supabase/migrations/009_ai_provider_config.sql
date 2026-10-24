-- ============================================================================
-- 009_ai_provider_config.sql
--
-- Admin-selectable AI provider and model for bill extraction (OCR) and insights.
--
-- Only the backend touches this table. It reads and writes with the service role
-- key, which bypasses RLS; RLS is enabled with NO policies so the browser's anon
-- and authenticated roles can neither read nor write it. Admin changes go through
-- the admin-gated /api/admin/ai-config endpoint.
--
-- API keys are NOT stored here. They stay in server env vars (GEMINI_API_KEY,
-- OPENROUTER_API_KEY). A missing row means the backend uses its built-in default
-- (Gemini, gemini-2.5-flash). Idempotent and safe to re-run.
-- ============================================================================

begin;

create table if not exists public.ai_config (
  id smallint primary key default 1 check (id = 1),
  provider text not null default 'gemini' check (provider in ('gemini', 'openrouter')),
  model text not null default 'gemini-2.5-flash' check (char_length(model) between 1 and 120),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.ai_config enable row level security;
revoke all on public.ai_config from anon, authenticated;

insert into public.ai_config (id) values (1) on conflict (id) do nothing;

commit;
