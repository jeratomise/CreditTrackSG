# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (tsx server.ts — runs Express backend)
npm run build    # Build frontend (vite build)
npm run preview  # Preview production build
npm start        # Run production server
```

There is no test or lint script configured.

## Architecture

Full-stack TypeScript monorepo: React SPA (Vite) + Express backend in a single repo.

**Entry points:**
- `index.tsx` → React app
- `server.ts` → Express server (also serves the built frontend in production)

**Request flow:**
```
Browser (React) → Express (server.ts) → Supabase (DB/Auth/Storage)
                                       → Google Gemini API (AI extraction)
                                       → Resend API (email delivery)
```

**Key layers:**

| Layer | Files |
|-------|-------|
| Types | `types.ts` |
| Constants & AI prompts | `constants.ts` |
| Auth & user session | `contexts/AuthContext.tsx` |
| Database CRUD | `services/dbService.ts` |
| AI (Gemini) | `services/geminiService.ts` |
| Supabase client | `lib/supabaseClient.ts` |
| Backend & cron jobs | `server.ts` |
| UI components | `components/` |

## Environment Variables

```
VITE_SUPABASE_URL        # Supabase project URL (used in frontend via Vite)
VITE_SUPABASE_ANON_KEY   # Supabase anon key (used in frontend)
SUPABASE_URL             # Supabase URL (used in backend/server.ts)
SUPABASE_ANON_KEY        # Supabase anon key (used in backend)
GEMINI_API_KEY           # Google Gemini API key (server-side only)
RESEND_API_KEY           # Resend email API key (server-side only)
EMAIL_FROM               # Sender address for email notifications
```

## Domain Context

The app is tailored for **Singapore credit card miles optimization**, drawing on The MileLion strategy. Key domain concepts:
- **Miles per dollar (mpd)** — the core metric for card optimization
- Supported banks: DBS, UOB, Citibank, HSBC, OCBC, Standard Chartered, AMEX
- AI prompts in `constants.ts` contain detailed Singapore card-specific logic for categorizing spend and detecting missed miles

## Supabase Schema

Core tables: `profiles`, `bills`, `transactions`, `system_config`, `email_logs`
Storage bucket: `bill-documents` (signed URLs with 1-hour expiry)

## Cron Jobs (server.ts)

- **Daily 9 AM** — bill payment reminders for bills due within 3 days
- **Monday 9 AM** — weekly financial summary emails

Manual trigger endpoints exist at `/api/trigger-reminders` and `/api/trigger-weekly` for testing.

## AI Integration

`services/geminiService.ts` uses **Gemini 2.5 Flash** for:
- Extracting bill data from uploaded PDFs/images
- Splitting consolidated multi-card statements
- Transaction categorization and optimization advice
- Risk score calculation (0–100)

All Gemini prompts are centralized in `constants.ts`.

## Auth & Roles

`contexts/AuthContext.tsx` manages Supabase Auth. Two roles: `admin` and `user`.
Admins can manage users (activate/suspend), configure system settings, and view email logs via `AdminPanel.tsx`.
