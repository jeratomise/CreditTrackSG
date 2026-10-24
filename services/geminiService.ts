import { AIExtractionResponse, AiModelConfig, AiSettings } from "../types";
import { supabase } from "../lib/supabaseClient";

// NOTE: All AI calls run on the server (see api/_routes/ai.ts), using the provider
// and model an admin picked. Provider keys are NEVER sent to the browser. This module
// is a thin authenticated client that forwards requests to our own backend.

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

/**
 * Extract structured bill data from a previously uploaded document.
 * @param filePath storage path returned by dbService.uploadBillDocument (e.g. "<uid>/123_ab.pdf").
 *                 The server downloads this file (verifying it belongs to the caller) and runs
 *                 the AI extraction — the raw file never has to fit in the request body.
 */
export const extractBillData = async (filePath: string): Promise<AIExtractionResponse> => {
  const res = await fetch("/api/extract-bill", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ filePath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Bill extraction failed");
  }

  return (await res.json()) as AIExtractionResponse;
};

export const generateOptimizationAdvice = async (transactions: any[]) => {
  if (!transactions || transactions.length === 0) {
    return { advice: "Upload bills to generate insights.", riskScore: 0, missedMiles: 0, anomalies: [] };
  }

  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ transactions }),
    });

    if (!res.ok) throw new Error("Insights request failed");
    return await res.json();
  } catch (error) {
    console.error(error);
    return { advice: "Could not generate advice.", riskScore: 0, missedMiles: 0, anomalies: [] };
  }
};

// --- Admin: AI provider and model ---

async function adminRequest<T>(method: "GET" | "PUT" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: await authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const getAiSettings = () => adminRequest<AiSettings>("GET", "/api/admin/ai-config");

export const saveAiSettings = (config: AiModelConfig) =>
  adminRequest<AiSettings>("PUT", "/api/admin/ai-config", config);

export const testAiSettings = (config: AiModelConfig) =>
  adminRequest<{ ok: boolean; latencyMs?: number; error?: string }>("POST", "/api/admin/ai-config/test", config);
