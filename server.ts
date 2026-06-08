// ──────────────────────────────────────────────────────────────────────────
// LOCAL DEVELOPMENT SERVER ONLY.
//
// Production runs on Vercel, which invokes `api/server.ts` as a serverless
// function (see vercel.json). This file exists purely so that `npm run dev`
// can serve the Vite-built SPA and the API from a single long-running process,
// and run the reminder cron jobs in-process for testing.
//
// It imports the SAME Express app and cron functions used in production, so dev
// and prod run identical, security-hardened code. Do not add routes here — add
// them to `api/server.ts`.
//
// `dotenv/config` MUST be the first import: it loads `.env` before `api/server`
// is evaluated, since that module reads process.env at module-load time.
// ──────────────────────────────────────────────────────────────────────────
import "dotenv/config";
import express from "express";
import cron from "node-cron";
import path from "path";
import { fileURLToPath } from "url";
import app, { runDailyReminders, runWeeklyUpdate } from "./api/server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  // In-process cron for LOCAL DEV ONLY. Production uses Vercel Cron (vercel.json),
  // which calls /api/trigger-* with the CRON_SECRET. Times are UTC (01:00 = 09:00 SGT).
  cron.schedule("0 1 * * *", () => {
    runDailyReminders().catch((err) => console.error("Daily reminder cron failed:", err));
  });
  cron.schedule("0 1 * * 1", () => {
    runWeeklyUpdate().catch((err) => console.error("Weekly update cron failed:", err));
  });

  if (process.env.NODE_ENV !== "production") {
    // Dev: hand non-API routes to Vite for HMR.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Self-hosted production fallback: serve the built SPA. (Not used on Vercel.)
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dev server running on http://localhost:${PORT}`);
  });
}

startServer();
