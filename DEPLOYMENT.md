# CreditTrack — Deployment Checklist

Production = **Vercel** (SPA + serverless `api/server.ts`), **Supabase** (DB/Auth/Storage), **Stripe**, **Resend**, **Gemini**. Work top to bottom; the ordering matters where noted.

---

## 0. Local pre-flight (run on your machine, in the project folder)

```bash
npm install            # installs zod (new) + the correct esbuild binary for your OS
npm run typecheck      # must be clean (the build does NOT type-check, so this is the gate)
npm run build          # vite build → dist/
npm run dev            # smoke test: sign in, upload a bill, mark paid, open Settings/billing
```

Do not proceed until `typecheck` and `build` are clean.

---

## 1. Rotate exposed secrets (do this first — see SECURITY_REVIEW.md §1)

All of these were exposed locally and must be regenerated:

- Resend API key, Google Gemini key, Stripe keys (if ever shared)
- **Both GitHub tokens**, including `ghp_xLY3…` which is **embedded in `.git/config`** as your `origin` URL.

After rotating the GitHub token, remove it from the remote URL so it isn't stored in plaintext:

```bash
git remote set-url origin https://github.com/jeratomise/CreditTrackSG.git
# then authenticate via Git Credential Manager, gh auth login, or a fresh PAT when prompted
```

---

## 2. Commit & push to GitHub

Current branch is **`production`**. Review what's staged first (note: `track_patch.cjs` is a one-off codemod — delete it unless you want it in the repo; some pre-existing edits to `App.tsx`, `README.md`, etc. will also be included).

```bash
git status
git rm --cached track_patch.cjs    # optional: keep the one-off script out of the repo
git add -A
git commit -m "Security hardening + backend consolidation (single app, lib/routes split, Zod, server-side Gemini)"
git push origin production
```

Confirm `.gitignore` is doing its job — none of these should appear in `git status`:
`.env`, `.env.production`, `.claude/`, `migrated_prompt_history/`, `CreditTrackSG-main/`.

---

## 3. Set Vercel environment variables

Project → Settings → Environment Variables (or `vercel env add`). **Server-only values must NOT be `VITE_`-prefixed.** Set for the **Production** environment:

| Variable | Notes |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **New / required.** Supabase → Settings → API → service_role. Server-only. |
| `GEMINI_API_KEY` | **New / required.** Server-only (no `VITE_`). |
| `CRON_SECRET` | Required — cron endpoints now fail closed without it. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Rotated values. |
| `STRIPE_PRO_PRICE_ID_MONTHLY`, `STRIPE_PRO_PRICE_ID_ANNUAL` | |
| `RESEND_API_KEY`, `EMAIL_FROM` | Rotated Resend key. |
| `APP_URL` | e.g. `https://credittrack.elitex.cc` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Public — fine in the browser bundle. |

**Then DELETE `VITE_GEMINI_API_KEY`** — leaving it would re-inline the key into the browser bundle and undo the server-side fix.

> Env-var changes only apply to **new** deployments — you must redeploy after editing them.

---

## 4. Deploy the backend

Pushing to the production branch triggers a Vercel production deploy automatically. (Confirm in Vercel → Settings → Git which branch is set as Production; it should be `production`.) Or deploy manually:

```bash
vercel --prod
```

This must land **before** step 5, because the tightened RLS depends on the backend using the service-role key.

---

## 5. Apply the database migration (AFTER the backend is live)

```bash
supabase db push        # applies supabase/migrations/007_security_hardening.sql
```

Then the one-time admin bootstrap (clients can no longer self-assign admin):

```sql
update public.profiles set role = 'admin' where email = 'jeratomise@gmail.com';
```

Optional hardening in Supabase dashboard: enable Auth → leaked-password protection.

---

## 6. Post-deploy verification

- `GET https://<app>/api/health` → `{"status":"ok"}`
- `GET https://<app>/api/status` → supabase/resend/gemini all `ok`
- Sign in as a **normal** user and confirm you **cannot** read other profiles or change your own role (RLS).
- Upload a statement → extraction works (Gemini now runs server-side).
- Start a Pro checkout and open the billing portal → both work.
- Trigger a reminder; confirm the email sends and appears in email-logs.
- In the deployed bundle, search the JS for `AIza` → should find **nothing** (Gemini key not exposed).

---

## 7. Rollback

If a deploy misbehaves: Vercel → Deployments → promote the previous good deployment. The migration is additive/tightening; to roll it back you'd restore the prior RLS policies (keep a snapshot before applying if you want a fast revert).
