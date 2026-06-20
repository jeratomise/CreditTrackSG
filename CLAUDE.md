# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- `api/_lib/` — shared, no HTTP: `clients.ts` (Supabase service-role / Stripe / Resend / Gemini init), `util.ts` (`esc`, `maskCardName`, `getDaysRemaining`), `auth.ts` (`requireAuth` → `req.authUser`, `validateCronSecret`), `email.ts` (`sendEmail`), `ai.ts` (Gemini extract/insights + prompt & schema — single source for the AI prompt), `validation.ts` (Zod schemas + `validate()` helper).
- `api/_cron.ts` — `runDailyReminders` / `runWeeklyUpdate` (the email-building scheduled jobs).
- `api/_routes/` — one Express `Router` per domain, each declaring absolute `/api/...` paths: `billing.ts` (webhook + checkout + portal), `health.ts` (health + status + the admin `/api/admin/users` listing), `reminders.ts` (schedule/cancel reminder + email-logs), `ai.ts` (extract-bill + insights), `triggers.ts` (cron triggers), `referrals.ts`.

⚠️ **The `_` prefix is load-bearing — do not remove it.** Vercel turns every NON-underscore `.ts` file under `api/` into its own serverless function, and the Hobby plan caps a deployment at **12 functions**. The helper dirs are prefixed with `_` so Vercel ignores them and bundles them into the single `api/server.ts` function. So: **never add a new top-level `api/*.ts` file** (it becomes a 13th+ function and the deploy fails at "Deploying outputs"); add endpoints inside an existing `api/_routes/*.ts` router instead. The Stripe webhook MUST stay on the JSON-parser skip-list in `api/server.ts`.

**Production request flow:**
```
Browser (React SPA) → Vercel static (dist/) for the app
                    → /api/* → api/server.ts (serverless) → Supabase (DB/Auth/Storage)
                                                           → Google Gemini (server-side AI)
                                                           → Resend (email)
                                                           → Stripe (billing)
```

**Frontend navigation:** single-page, **no router library**. `App.tsx` holds a `view` state (`'dashboard' | 'upload' | 'settings' | 'admin' | 'logs' | 'referral'`) and swaps components. `index.tsx` wraps `<App>` in `<AuthProvider>` + Vercel `<Analytics>`.

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
GEMINI_API_KEY                          # server-side Gemini
RESEND_API_KEY / EMAIL_FROM             # email delivery
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID_MONTHLY / STRIPE_PRO_PRICE_ID_ANNUAL
CRON_SECRET                             # auth for Vercel Cron → /api/trigger-*
APP_URL                                 # base URL for links/redirects
```

## Supabase

Tables: `profiles`, `bills`, `transactions`, `system_config`, `email_logs`, `referrals`, `ai_insights`, `user_settings`, `annual_fees`. Storage bucket: `bill-documents` (1-hour signed URLs). Migrations live in `supabase/migrations/` (apply with `supabase db push`; 007 is the security-hardening migration and assumes the service-role backend is deployed first).

## Cron (production = Vercel Cron, not node-cron)

`vercel.json` defines the schedule and hits `/api/trigger-weekly` (and reminders) with `Authorization: Bearer CRON_SECRET`. The in-process `cron.schedule(...)` in `server.ts` only runs in local dev. Reminders also use Resend `scheduledAt` (see `/api/schedule-reminder`) keyed off bill due dates.

## Roles & billing

Roles: `user`, `pro`, `admin`. `pro` is granted by the verified Stripe webhook (`checkout.session.completed`) and revoked on cancellation; `admin` is set manually in the DB. Referrals (`/api/referrals/*`) reward the referrer only when the referee is a genuine paying Pro.

## Domain context

Tailored for **Singapore credit-card miles optimization** (The MileLion strategy). Core metric is **miles per dollar (mpd)**; supported banks include DBS, UOB, Citibank, HSBC, OCBC, Standard Chartered, AMEX. The AI extracts/splits consolidated multi-card statements, categorizes spend, flags missed-miles opportunities, and computes a 0–100 risk score. AI runs server-side only: `MILELION_SYSTEM_PROMPT` (the persona) lives in `constants.ts`; the extraction/insights prompts, response schemas, and Gemini calls live in `api/lib/ai.ts`. The browser never holds the Gemini key.
