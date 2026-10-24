import { Router } from "express";
import { requireAuth, requireAdmin } from "../_lib/auth.js";
import { validate, extractBillSchema, insightsSchema, aiConfigSchema } from "../_lib/validation.js";
import { extractBillFromStorage, generateInsights, testAiModel } from "../_lib/ai.js";
import { checkExtraction } from "../_lib/billChecks.js";
import {
  DEFAULT_AI_CONFIG,
  SUGGESTED_MODELS,
  getActiveAiConfig,
  getStoredAiConfig,
  hasProviderKey,
  providerKeyName,
  providerKeyStatus,
  saveAiConfig,
} from "../_lib/aiConfig.js";
import type { AiProvider, AiSettings } from "../../types";

const router = Router();

function missingKeyMessage(provider: AiProvider): string {
  return `${providerKeyName(provider)} is not set on the server. Add it in Vercel → Settings → Environment Variables, then redeploy.`;
}

async function aiSettings(): Promise<AiSettings> {
  return {
    config: await getStoredAiConfig(),
    active: await getActiveAiConfig(),
    defaults: DEFAULT_AI_CONFIG,
    suggestions: SUGGESTED_MODELS,
    keys: providerKeyStatus(),
  };
}

// POST /api/extract-bill — extract structured bill data from an uploaded document.
// Auth required. The caller sends only the storage path of a file they uploaded; the
// server downloads it (after verifying ownership) and runs the admin-selected model.
// This keeps provider keys server-side AND avoids serverless request-body size limits.
router.post("/api/extract-bill", requireAuth, async (req: any, res) => {
  const ai = await getActiveAiConfig();
  if (!hasProviderKey(ai.provider)) return res.status(503).json({ error: "AI is not configured" });

  const parsed = validate(extractBillSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { filePath } = parsed.data;

  // Ownership: storage paths are "<userId>/<file>". Reject anything not owned by the
  // authenticated user (also blocks path traversal like "../other-user/...").
  if (!filePath.startsWith(`${req.authUser.id}/`) || filePath.includes("..")) {
    return res.status(403).json({ error: "File not found for this user" });
  }

  try {
    const result = checkExtraction(await extractBillFromStorage(filePath, ai));
    return res.json({ ...result, extraction: ai });
  } catch (err: any) {
    console.error(`Error extracting bill data (${ai.provider}/${ai.model}):`, err?.message || err);
    return res.status(500).json({ error: "Bill extraction failed" });
  }
});

// POST /api/insights — optimization advice + risk score for a set of transactions.
// Auth required. Input is validated and capped to keep prompt size and cost bounded.
router.post("/api/insights", requireAuth, async (req: any, res) => {
  const ai = await getActiveAiConfig();
  if (!hasProviderKey(ai.provider)) return res.status(503).json({ error: "AI is not configured" });

  const parsed = validate(insightsSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  if (parsed.data.transactions.length === 0) {
    return res.json({ advice: "Upload bills to generate insights.", riskScore: 0, missedMiles: 0, anomalies: [] });
  }

  try {
    const result = await generateInsights(parsed.data.transactions, ai);
    return res.json(result);
  } catch (err: any) {
    console.error(`Error generating insights (${ai.provider}/${ai.model}):`, err?.message || err);
    return res.json({ advice: "Could not generate advice.", riskScore: 0, missedMiles: 0, anomalies: [] });
  }
});

// GET /api/admin/ai-config — saved and active provider/model, plus which keys are set.
// Key status is a boolean only; key values never leave the server.
router.get("/api/admin/ai-config", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await aiSettings());
});

// PUT /api/admin/ai-config — save the provider/model used by extraction and insights.
router.put("/api/admin/ai-config", requireAuth, requireAdmin, async (req: any, res) => {
  const parsed = validate(aiConfigSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  if (!hasProviderKey(parsed.data.provider)) {
    return res.status(400).json({ error: missingKeyMessage(parsed.data.provider) });
  }

  try {
    await saveAiConfig(parsed.data, req.authUser.id);
    return res.json(await aiSettings());
  } catch (err: any) {
    console.error("Error saving AI config:", err?.message || err);
    return res.status(500).json({ error: "Could not save AI settings" });
  }
});

// POST /api/admin/ai-config/test — one tiny request to the chosen provider/model, so
// an admin can confirm a model ID works before switching every upload to it.
router.post("/api/admin/ai-config/test", requireAuth, requireAdmin, async (req, res) => {
  const parsed = validate(aiConfigSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  if (!hasProviderKey(parsed.data.provider)) {
    return res.status(400).json({ error: missingKeyMessage(parsed.data.provider) });
  }

  const started = Date.now();
  try {
    await testAiModel(parsed.data);
    return res.json({ ok: true, latencyMs: Date.now() - started });
  } catch (err: any) {
    return res.json({ ok: false, error: String(err?.message || err).slice(0, 300) });
  }
});

export default router;
