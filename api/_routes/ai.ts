import { Router } from "express";
import { genai } from "../_lib/clients.js";
import { requireAuth } from "../_lib/auth.js";
import { validate, extractBillSchema, insightsSchema } from "../_lib/validation.js";
import { extractBillFromStorage, generateInsights } from "../_lib/ai.js";

const router = Router();

// POST /api/extract-bill — extract structured bill data from an uploaded document.
// Auth required. The caller sends only the storage path of a file they uploaded; the
// server downloads it (after verifying ownership) and runs Gemini. This keeps the
// Gemini key server-side AND avoids serverless request-body size limits on large PDFs.
router.post("/api/extract-bill", requireAuth, async (req: any, res) => {
  if (!genai) return res.status(503).json({ error: "AI is not configured" });

  const parsed = validate(extractBillSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { filePath } = parsed.data;

  // Ownership: storage paths are "<userId>/<file>". Reject anything not owned by the
  // authenticated user (also blocks path traversal like "../other-user/...").
  if (!filePath.startsWith(`${req.authUser.id}/`) || filePath.includes("..")) {
    return res.status(403).json({ error: "File not found for this user" });
  }

  try {
    const result = await extractBillFromStorage(filePath);
    return res.json(result);
  } catch (err: any) {
    console.error("Error extracting bill data:", err?.message || err);
    return res.status(500).json({ error: "Bill extraction failed" });
  }
});

// POST /api/insights — optimization advice + risk score for a set of transactions.
// Auth required. Input is validated and capped to keep prompt size and cost bounded.
router.post("/api/insights", requireAuth, async (req: any, res) => {
  if (!genai) return res.status(503).json({ error: "AI is not configured" });

  const parsed = validate(insightsSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  if (parsed.data.transactions.length === 0) {
    return res.json({ advice: "Upload bills to generate insights.", riskScore: 0, missedMiles: 0, anomalies: [] });
  }

  try {
    const result = await generateInsights(parsed.data.transactions);
    return res.json(result);
  } catch (err: any) {
    console.error("Error generating insights:", err?.message || err);
    return res.json({ advice: "Could not generate advice.", riskScore: 0, missedMiles: 0, anomalies: [] });
  }
});

export default router;
