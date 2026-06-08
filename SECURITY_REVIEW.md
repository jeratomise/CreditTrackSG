# CreditTrack — Security Review & Hardening

_Date: 2026-06-08 · Scope: full repository + live Supabase RLS posture_

## TL;DR

The MiniMax Base URL in your Cursor config is unrelated to this app — it only affects the model your editor talks to, not CreditTrack's runtime. There is no MiniMax reference anywhere in the code.

The review did, however, find **several serious, live vulnerabilities** — most of them exploitable with only the public anon key that ships in every browser. The headline issues: any logged-in user could make themselves **admin** or **Pro for free**, the `email_logs` table was **world-readable**, every user's email + Stripe IDs were **publicly enumerable**, and several backend endpoints had **no authentication** (billing portal takeover, open email-sending). A live **Resend API key was hardcoded** in `server.ts`.

Code-level fixes have been applied to the repo. Database-level fixes are delivered as migration `007_security_hardening.sql` with a deploy runbook below.

---

## 1. Secrets to rotate immediately

These were found in plaintext on disk and/or committed. Treat all as compromised and regenerate:

| Secret | Where found | Action |
|---|---|---|
| Resend API key `re_fWZS…` | **Hardcoded** in `server.ts` (committed) + `.claude/settings.local.json` | Rotate in Resend dashboard |
| GitHub fine-grained PAT `github_pat_11ACTD…` | `.claude/settings.local.json` | Revoke in GitHub → Settings → Developer settings |
| GitHub classic token `ghp_xLY3…` | `.claude/settings.local.json` | Revoke |
| Gemini API key `AIzaSy…` | `.claude/settings.local.json` | Rotate in Google AI Studio |
| Stripe secret key `rk_live…` + webhook secret | `.env.production` | Rotate if this file was ever shared/committed |

`.gitignore` has been fixed (`.env*` now ignored, `.claude/` and prompt history already were), so these won't be pushed — but rotation is still required because they've already been exposed locally.

---

## 2. Findings & status

### CRITICAL

**C1 — Privilege escalation: users can self-assign `admin` / `pro`.**
The `profiles` UPDATE policy `Users can update own profile` used `USING (auth.uid() = id)` with no column protection. Since the browser writes profiles directly with the anon key, any logged-in user could run `update profiles set role='admin'` (or `'pro'`) on their own row — instant admin takeover and unlimited free Pro.
→ _Fixed in migration 007_: a `BEFORE INSERT/UPDATE` trigger forces `role`, `status`, `stripe_*`, `pro_*` to safe/unchanged values for any non-service-role writer. Client code no longer sends `role` (`AuthContext.tsx`).

**C2 — `email_logs` had RLS disabled entirely.**
A policy existed but RLS was off, so the table was fully readable/writable via the public anon key — every user's email address and bill details (`details` JSON) exposed.
→ _Fixed in migration 007_: RLS enabled; users read only their own logs; writes happen only from the trusted backend (service role).

**C3 — Unauthenticated Stripe customer-portal endpoint (account takeover).**
`POST /api/create-portal-session` took `userId` from the request body with no auth, then returned a Stripe billing-portal URL for that customer — letting anyone open, manage, or cancel **another user's** subscription and view billing details (IDOR).
→ _Fixed_: now requires a valid JWT; the Stripe customer is resolved from the **verified** user's own profile.

### HIGH

**H1 — Public profile enumeration.** `profiles` SELECT policy was `USING (true)` → anyone with the anon key could dump all users' emails, names, roles, and Stripe customer IDs.
→ _Fixed in migration 007_: SELECT restricted to own row, or admins via a `SECURITY DEFINER is_admin()` helper.

**H2 — Unauthenticated checkout + email-log endpoints.** `create-checkout-session` and `email-logs` trusted a body/query `userId`. `email-logs` let anyone read any user's logs.
→ _Fixed_: both now require a JWT and derive identity from the token, ignoring client-supplied IDs. Clients (`Settings.tsx`, `EmailLogs.tsx`) updated to send the bearer token.

**H3 — Open email-sending endpoints (abuse + HTML injection).** `schedule-reminder` / `cancel-reminder` had no auth: anyone could send attacker-composed emails through your Resend account (spam, phishing, reputation/cost damage), and could cancel arbitrary reminders. User-controlled fields were interpolated into email HTML unescaped.
→ _Fixed_: both require a JWT; the bill must belong to the verified user; recipient/identity come from the token; all user text is HTML-escaped via `esc()`.

**H4 — Hardcoded live Resend key in `server.ts`.**
→ _Fixed_: hardcoded fallback removed; key now comes only from the environment.

**H5 — Gemini API key exposed to the browser.** `geminiService.ts` read `VITE_GEMINI_API_KEY`, which Vite **inlines into the client bundle** — anyone could extract it from the deployed JS or network tab and run up your Google AI billing. Vercel cannot fix this; the key is compiled into the client code at build time.
→ _Fixed_: both Gemini calls now run **server-side** behind authenticated endpoints `POST /api/extract-bill` and `POST /api/insights`, using a server-only `GEMINI_API_KEY`. The browser client (`geminiService.ts`) only forwards requests with the user's JWT. Extraction reads the uploaded file **from Supabase Storage by path** (ownership-checked), so the key is gone from the browser AND large PDFs no longer hit serverless body limits. **Action required:** set `GEMINI_API_KEY` (no `VITE_` prefix) in Vercel and **delete `VITE_GEMINI_API_KEY`** (see §4).

### MEDIUM

**M1 — Cron triggers failed open.** `validateCronSecret` only enforced the secret *if* `CRON_SECRET` was set; unset = world-open mass-email trigger.
→ _Fixed_: now fails closed (503 if unset) and uses a constant-time comparison.

**M2 — Referral reward farming.** `check-reward` rewarded the referrer for any pending referral without verifying the referee actually paid — two colluding accounts could mint unlimited free Pro.
→ _Fixed_: reward now requires the referee to be a genuine paying Pro (`role='pro'` **and** a Stripe subscription set by the verified webhook).

**M3 — Verbose error leakage.** Endpoints returned raw `err.message` to clients.
→ _Partially fixed_: billing/email endpoints now return generic messages and log details server-side. (A few referral endpoints still echo `err.message` — low risk, listed in §4.)

**M4 — No security headers / no body-size limit.**
→ _Fixed_: baseline headers (`X-Content-Type-Options`, `X-Frame-Options`, HSTS, `Referrer-Policy`, `Permissions-Policy`), `x-powered-by` disabled, and a 256 KB JSON body limit added.

### LOW / Hygiene

- **L1** Supabase Auth "leaked password protection" is disabled → enable it (Auth → Policies; checks HaveIBeenPwned).
- **L2** `generate_referral_code()` had a mutable `search_path` → pinned in migration 007.
- **L3** `console.log(session)` in `AuthContext` logs session objects to the browser console → remove before production.
- **L4** `export default app` sat mid-file before route registration → moved to the end.

---

## 3. Files changed in this pass

- `.gitignore` — ignore all `.env*` (keep `.env.example`).
- `server.ts` — removed hardcoded Resend key.
- `api/server.ts` — service-role Supabase client; security headers; body limit; `esc()` HTML-escaping; auth + ownership on checkout/portal/email-logs/schedule-reminder/cancel-reminder; fail-closed constant-time cron secret; referral anti-abuse; export moved to end.
- `components/Settings.tsx`, `components/EmailLogs.tsx`, `services/dbService.ts` — send the bearer token; stop sending client-supplied identity.
- `contexts/AuthContext.tsx` — no longer sets `role` on signup.
- `supabase/migrations/007_security_hardening.sql` — RLS + trigger + policy fixes (NEW).

> Note: an automated `tsc` pass could not be completed in this session due to a workspace file-sync lag (the sandbox kept reading stale copies). The build uses esbuild/vite (not `tsc`), and all edits were verified syntactically against the authoritative files. Run `npm run build` locally to confirm before deploying.

---

## 4. Deployment runbook (order matters)

1. **Rotate** every secret in §1.
2. In Vercel project env vars, add **`SUPABASE_SERVICE_ROLE_KEY`** (Supabase → Settings → API → service_role key). Server-only — do **not** prefix with `VITE_`.
2b. Add **`GEMINI_API_KEY`** (server-only, no `VITE_`) and **DELETE `VITE_GEMINI_API_KEY`** so the key is no longer inlined into the browser bundle. Redeploy after removing it.
3. Confirm `CRON_SECRET` is set (cron now refuses to run without it).
4. **Deploy the backend** (`api/server.ts`) so it uses the service-role key — this must land *before* the DB migration, or cron/webhook/email-logs will break under the tightened RLS.
5. **Apply migration 007**: `supabase db push` (or paste into the Supabase SQL editor). Then run the one-time admin bootstrap at the bottom of the file:
   `update public.profiles set role='admin' where email='jeratomise@gmail.com';`
6. **Verify**: log in as a normal user and confirm you cannot read other profiles or change your own role; confirm checkout/billing portal still work; confirm an email reminder still sends.

### Recommended follow-ups (not yet implemented)

- **Edge rate limiting** — in-memory limiters are ineffective on serverless; use Vercel WAF / firewall rules or an Upstash-backed limiter on `/api/*`, especially auth, checkout, AI, and email endpoints.
- Enable leaked-password protection (L1) and remove session `console.log`s (L3).
- Consider `bills`/`transactions` server-side validation of amounts/dates on insert.
