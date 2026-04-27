
import { AIExtractionResponse } from "../types";
import { supabase } from "../lib/supabaseClient";

// Gemini calls now run on the server (api/server.ts) — this module is a thin
// fetch wrapper. Reasons:
//   1. Browser-originated calls to generativelanguage.googleapis.com were
//      rejected with HTTP 405 (CORS preflight blocked by API key restrictions).
//   2. Embedding the API key in the browser bundle (VITE_GEMINI_API_KEY) leaks it.
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function postJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error */ }
  if (!res.ok) {
    const message = data?.error || text || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const extractBillData = async (
  base64Data: string,
  mimeType: string = "image/png",
): Promise<AIExtractionResponse> => {
  return postJson<AIExtractionResponse>("/api/extract-bill", { base64Data, mimeType });
};

export const generateOptimizationAdvice = async (transactions: any[]) => {
  try {
    return await postJson<{ advice: string; riskScore: number; missedMiles: number; anomalies: string[] }>(
      "/api/optimize",
      { transactions },
    );
  } catch (err) {
    console.error(err);
    return { advice: "Could not generate advice.", riskScore: 0, missedMiles: 0, anomalies: [] };
  }
};
