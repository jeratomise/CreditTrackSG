# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## New machine or new Cursor account

Before feature work, follow `.cursor/agents/project-setup.md`. Cursor loads that prompt from `.cursor/rules/session-setup.mdc`. Do not edit until local `HEAD`, `origin/production`, and the live Vercel deployment commit are the same. If this checkout is behind GitHub or Vercel, stop and ask before pulling. Check connections by name only. Do not print secrets, create a new Supabase project, or push `production` unless the user asks in this chat.

The variable list is `.env.example`. `supabase/migrations/` contains only `006`–`011` (alters). The base schema is not in this repo.

Security audits follow `.cursor/agents/security-auditor.md`. Hand the fix brief to Claude Code in this folder. Claude Code already reads this file and `CLAUDE.md`. Do not deploy as part of the audit.

## Commands

```bash
npm run dev        # Local dev: tsx server.ts — imports the prod app + Vite HMR on :3000
npm run build      # Production build of the SPA (vite build → dist/)
npm run preview    # Preview the built SPA
npm start          # tsx server.ts (self-hosted run; set NODE_ENV=production to serve dist/)
npm run typecheck  # tsc --noEmit (the build itself is esbuild-based and does NOT type-check)
```

No test suite is configured. The production build is **esbuild-based via Vite** — it does NOT run `tsc`, so type errors don't fail the build; run `npm run typecheck` to catch them.

## Architecture

Full-stack TypeScript monorepo: a React SPA (Vite) + an Express backend, deployed on **Vercel**.

**Single backend, two entry points (consolidated):**
- `api/server.ts` — **the entry.** Only wires middleware (security headers, a JSON parser that skips the Stripe webhook path so the raw body survives) and mounts the routers; `export default app` is the Vercel serverless entry (`vercel.json` routes `/api/*` here). Re-exports `runDailyReminders` / `runWeeklyUpdate` from `./cron` for dev.
- `server.ts` — **local dev wrapper only.** Imports the SAME `app` + cron fns from `api/server.ts`, loads `dotenv` first, mounts Vite/static, schedules in-process cron, and `listen`s. Never add routes here.

**Backend layout:**
- `api/_lib/` — shared, no HTTP: `clients.ts` (Supabase service-role / Stripe / Resend / Gemini init), `util.ts` (`esc`, `maskCardName`, `getDaysRemaining`), `auth.ts` (`requireAuth` → `req.authUser`, `requireAdmin`, `validateCronSecret`), `email.ts` (`sendEmail`), `ai.ts` (Gemini/OpenRouter extract/insights + prompt & schema — single source for the AI prompt), `aiConfig.ts` (admin-selected provider/model from the `ai_config` table, default Gemini `gemini-2.5-flash`), `validation.ts` (Zod schemas + `validate()` helper).
- `api/_cron.ts` — `runDailyReminders` / `runWeeklyUpdate` (the email-building scheduled jobs).
- `api/_routes/` — one Express `Router` per domain, each declaring absolute `/api/...` paths: `billing.ts` (webhook + checkout + portal), `health.ts` (health + status + the admin `/api/admin/users` listing), `reminders.ts` (schedule/cancel reminder + email-logs), `ai.ts` (extract-bill + insights + admin `/api/admin/ai-config`), `triggers.ts` (cron triggers), `referrals.ts`.

⚠️ **The `_` prefix is load-bearing — do not remove it.** Vercel turns every NON-underscore `.ts` file under `api/` into its own serverless function, and the Hobby plan caps a deployment at **12 functions**. The helper dirs are prefixed with `_` so Vercel ignores them and bundles them into the single `api/server.ts` function. So: **never add a new top-level `api/*.ts` file** (it becomes a 13th+ function and the deploy fails at "Deploying outputs"); add endpoints inside an existing `api/_routes/*.ts` router instead. The Stripe webhook MUST stay on the JSON-parser skip-list in `api/server.ts`.

**Production request flow:**
```
Browser (React SPA) → Vercel static (dist/) for the app
                    → /api/* → api/server.ts (serverless) → Supabase (DB/Auth/Storage)
                                                           → Google Gemini (server-side AI)
                                                           → Resend (email)
                                                           → Stripe (billing)
```

**Frontend navigation:** single-page, **no router library**. `App.tsx` holds a `view` state (`'dashboard' | 'upload' | 'settings' | 'admin' | 'logs' | 'referral' | 'review'`) and swaps components. `index.tsx` wraps `<App>` in `<AuthProvider>` + Vercel `<Analytics>`.

**Key layers:**

| Concern | Files |
|---|---|
| Types | `types.ts` |
| Constants & AI prompts | `constants.ts` (`MILELION_SYSTEM_PROMPT`) |
| Auth & session, admin actions | `contexts/AuthContext.tsx` |
| DB CRUD (browser → Supabase) | `services/dbService.ts` |
| AI client (browser → our API) | `services/geminiService.ts` |
| Browser Supabase client (anon key) | `lib/supabaseClient.ts` |
| Backend entry (prod) | `api/server.ts` (middleware + router mounting) |
| HTTP route handlers | `api/_routes/` (billing, health, reminders, ai, triggers, referrals) |
| Scheduled jobs | `api/_cron.ts` |
| Backend shared logic | `api/_lib/` (clients, util, auth, email, ai, validation) |
| Backend (dev only) | `server.ts` |
| DB migrations | `supabase/migrations/` |

## Security invariants (do not regress)

These were established in a security review; preserve them in any refactor:

- **Backend uses the Supabase SERVICE ROLE key** (`SUPABASE_SERVICE_ROLE_KEY`), which bypasses RLS. Therefore every user-facing endpoint MUST authenticate via `requireAuth` and derive identity from the verified JWT (`req.authUser.id`) — **never trust a `userId`/`email` from the request body or query** (prevents IDOR).
- **RLS is enabled on every table** and is the real authorization boundary for browser→Supabase calls (the anon key is public). See `supabase/migrations/007_security_hardening.sql`.
- **`profiles` privileged columns** (`role`, `status`, `stripe_*`, `pro_*`) are protected by a DB trigger — clients cannot escalate to admin/pro. Role grants happen server-side only (Stripe webhook for `pro`; manual SQL for `admin`).
- **Gemini runs server-side only** (`/api/extract-bill`, `/api/insights`) using `GEMINI_API_KEY`. Never reintroduce `VITE_GEMINI_API_KEY` — any `VITE_`-prefixed var is inlined into the browser bundle.
- **Bill extraction reads the uploaded file from Supabase Storage by path** (ownership-checked) rather than accepting base64 in the body — keeps the key server-side and avoids Vercel's ~4.5 MB body limit.
- **Emails:** all user-controlled text is escaped via `esc()` before HTML interpolation.
- **Cron endpoints fail closed:** `/api/trigger-*` require `CRON_SECRET` (constant-time compare) and refuse to run if it's unset.
- Secrets come only from env vars — never hardcode keys (a Resend key was previously hardcoded in `server.ts`).

## Environment Variables

```
# Frontend (inlined into the browser bundle — only PUBLIC values here)
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

# Backend (server-only — never VITE_ prefixed)
SUPABASE_URL / SUPABASE_ANON_KEY        # fallbacks
SUPABASE_SERVICE_ROLE_KEY               # privileged backend DB access (required in prod)
GEMINI_API_KEY                          # server-side Gemini (default AI provider)
OPENROUTER_API_KEY                      # optional; enables OpenRouter in Admin → AI model
RESEND_API_KEY / EMAIL_FROM             # email delivery
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID_MONTHLY / STRIPE_PRO_PRICE_ID_ANNUAL
CRON_SECRET                             # auth for Vercel Cron → /api/trigger-*
APP_URL                                 # base URL for links/redirects
```

## Supabase

Tables: `profiles`, `bills`, `transactions`, `system_config`, `email_logs`, `referrals`, `ai_insights`, `user_settings`, `annual_fees`, `ai_config` (service-role only; admin AI provider/model), `extraction_corrections` (users insert/read their own review edits). Storage bucket: `bill-documents` (1-hour signed URLs). Migrations live in `supabase/migrations/` (`006`–`011`, all alters on the existing live project; 007 is the security-hardening migration and assumes the service-role backend is deployed first).

**Applying a migration to live:** recommend the Supabase dashboard SQL Editor (https://supabase.com/dashboard/project/gaxfdvmqgflsqommdeth/sql/new). The user pastes the migration file and clicks Run; "Success. No rows returned" means it worked. Do not default to `supabase db push`, `psql`, or a direct Postgres script: the CLI and psql are not installed, the direct DB host is IPv6-only, the pooler region is not ap-southeast-1, and the Cursor Supabase MCP is signed into a different account. Write migrations to be idempotent. Afterwards verify with the anon key: `GET /rest/v1/<table>` returning 401 `42501 permission denied` on a service-role-only table confirms it exists and is locked down.

## Cron (production = Vercel Cron, not node-cron)

`vercel.json` defines the schedule and hits `/api/trigger-weekly` (and reminders) with `Authorization: Bearer CRON_SECRET`. The in-process `cron.schedule(...)` in `server.ts` only runs in local dev. Reminders also use Resend `scheduledAt` (see `/api/schedule-reminder`) keyed off bill due dates.

## Roles & billing

Roles: `user`, `pro`, `admin`. `pro` is granted by the verified Stripe webhook (`checkout.session.completed`) and revoked on cancellation; `admin` is set manually in the DB. Referrals (`/api/referrals/*`) reward the referrer only when the referee is a genuine paying Pro.

## Domain context

Tailored for **Singapore credit-card miles optimization** (The MileLion strategy). Core metric is **miles per dollar (mpd)**; supported banks include DBS, UOB, Citibank, HSBC, OCBC, Standard Chartered, AMEX. The AI extracts/splits consolidated multi-card statements, categorizes spend, flags missed-miles opportunities, and computes a 0–100 risk score. AI runs server-side only: `MILELION_SYSTEM_PROMPT` (the persona) lives in `constants.ts`; the extraction/insights prompts, response schemas, and provider calls live in `api/_lib/ai.ts`. Admins pick Gemini or OpenRouter and the model in Admin → AI model. The browser never holds a provider key.
