// ──────────────────────────────────────────────────────────────────────────
// Backend entry point.
//
// In production this file is the Vercel serverless function (vercel.json routes
// /api/* here). It only wires middleware and mounts the per-domain routers; all
// business logic lives in ./lib/* (shared helpers/clients), ./cron.ts (scheduled
// jobs) and ./routes/* (HTTP handlers).
//
// SECURITY: the backend uses the Supabase SERVICE ROLE key (see lib/clients.ts),
// which bypasses RLS — so every user-facing route derives identity from the
// verified JWT via requireAuth, never from the request body.
// ──────────────────────────────────────────────────────────────────────────
import express from "express";

import billingRouter from "./_routes/billing.js";
import healthRouter from "./_routes/health.js";
import remindersRouter from "./_routes/reminders.js";
import aiRouter from "./_routes/ai.js";
import triggersRouter from "./_routes/triggers.js";
import referralsRouter from "./_routes/referrals.js";

const app = express();
app.disable("x-powered-by");

// Baseline security response headers (no extra dependency required).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

// JSON body parser for every route EXCEPT the Stripe webhook, which needs the raw
// body for signature verification (handled by express.raw in routes/billing.ts).
// Skipping it here means router mount order can never break the webhook.
const jsonParser = express.json({ limit: "1mb" });
app.use((req, res, next) => {
  if (req.path === "/api/stripe-webhook") return next();
  return jsonParser(req, res, next);
});

// Mount routers. Each declares absolute "/api/..." paths.
app.use(billingRouter);
app.use(healthRouter);
app.use(remindersRouter);
app.use(aiRouter);
app.use(triggersRouter);
app.use(referralsRouter);

// Re-exported so the local dev server (server.ts) can schedule them in-process.
// In production these run via Vercel Cron hitting /api/trigger-*.
export { runDailyReminders, runWeeklyUpdate } from "./_cron.js";

export default app;
