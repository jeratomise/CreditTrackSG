import express from "express";
import crypto from "crypto";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./clients";

// Express request augmented with the verified Supabase user. Handlers behind
// requireAuth can rely on req.authUser being present.
export interface AuthedRequest extends express.Request {
  authUser: User;
}

/**
 * Verifies the caller is a logged-in Supabase user and attaches the verified user
 * to req.authUser. Downstream handlers MUST use req.authUser.id as the acting
 * identity — never an id taken from the request body/query (prevents IDOR).
 */
export async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!supabase) return res.status(500).json({ error: "Auth not initialized" });
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: "Invalid session" });

  (req as AuthedRequest).authUser = data.user;
  next();
}

/**
 * Cron-secret middleware. FAILS CLOSED: if CRON_SECRET is unset the endpoint is
 * denied rather than left public. Uses a length-safe constant-time comparison to
 * avoid leaking the secret via timing.
 */
export function validateCronSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set — refusing to run cron trigger.");
    return res.status(503).json({ error: "Cron not configured" });
  }
  const expected = `Bearer ${cronSecret}`;
  const provided = String(req.headers["authorization"] || "");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
