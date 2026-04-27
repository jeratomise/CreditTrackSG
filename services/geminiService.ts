
import { GoogleGenAI, Type } from "@google/genai";
import { MILELION_SYSTEM_PROMPT } from "../constants";
import { AIExtractionResponse } from "../types";

let ai: GoogleGenAI | null = null;

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";
const RETRYABLE_CODES = [429, 500, 502, 503, 504];

const getAI = () => {
  if (!ai) {
    // In the browser (Vite), reads from VITE_GEMINI_API_KEY set in Vercel env vars.
    // On the server (Node.js), reads from GEMINI_API_KEY (server-side only, not exposed to browser).
    const apiKey =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
      (typeof process !== 'undefined' && (process.env?.GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY));

    if (!apiKey) {
      console.error("Gemini API key is missing. Set VITE_GEMINI_API_KEY in your environment variables.");
      return null;
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryable = (err: any): boolean => {
  const status = err?.status ?? err?.error?.code ?? err?.code;
  if (RETRYABLE_CODES.includes(Number(status))) return true;
  const message = String(err?.message ?? "");
  if (RETRYABLE_CODES.some(code => message.includes(`"code":${code}`))) return true;
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|DEADLINE_EXCEEDED/i.test(message);
};

const friendlyError = (err: any): Error => {
  const message = String(err?.message ?? "");
  if (/UNAVAILABLE|503|experiencing high demand|overloaded/i.test(message)) {
    return new Error("Gemini is temporarily overloaded. Please wait a minute and try again.");
  }
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(message)) {
    return new Error("Gemini API quota reached. Please wait a moment before retrying.");
  }
  if (/PERMISSION_DENIED|API key|401|403|INVALID_ARGUMENT/i.test(message)) {
    return new Error("Gemini API key is invalid or lacks permission for this model.");
  }
  return err instanceof Error ? err : new Error(message || "Unknown Gemini error");
};

// Retries on transient errors (overload/quota/5xx) with exponential backoff,
// then falls back to a secondary model if the primary remains unavailable.
async function callGeminiWithRetry<T>(
  fn: (model: string) => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(PRIMARY_MODEL);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) throw friendlyError(err);
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 400);
        console.warn(`Gemini ${PRIMARY_MODEL} attempt ${attempt} failed (retryable). Retrying in ${delay}ms.`);
        await sleep(delay);
      }
    }
  }
  try {
    console.warn(`Gemini ${PRIMARY_MODEL} exhausted retries. Falling back to ${FALLBACK_MODEL}.`);
    return await fn(FALLBACK_MODEL);
  } catch (err) {
    throw friendlyError(err ?? lastError);
  }
}

export const extractBillData = async (base64Data: string, mimeType: string = "image/png"): Promise<AIExtractionResponse> => {
  try {
    const aiClient = getAI();
    if (!aiClient) throw new Error("AI client not initialized");
    const response = await callGeminiWithRetry((model) => aiClient.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: `Analyze this credit card statement. It is likely a CONSOLIDATED STATEMENT containing multiple cards.

            **CRITICAL: SPLIT BY CARD**
            You must identify *every* distinct card in this document and create a separate bill entry for each.
            
            **DBS / POSB INSTRUCTIONS:**
            1.  **Find Card Headers**: Look for gray header bars or lines containing text like **"CARD NO.:"** (e.g., "DBS YUU AMERICAN EXPRESS CARD NO.: XXX", "DBS VANTAGE VISA INFINITE CARD NO.: XXX").
            2.  **Separate Sections**: Treat each header as the start of a completely new bill.
            3.  **Extract Specific Total**: For each card section, look for the **"SUB-TOTAL:"** or **"TOTAL:"** row *immediately following* that card's transaction list. Use this as the \`totalAmount\`. Do NOT use the document's Grand Total.
            4.  **Date**: The "Payment Due Date" is usually common for all cards in the statement (at the top of Page 1). Use that.
            
            **AMEX INSTRUCTIONS:**
            - Look for "Closing Balance" on the first page.
            - Date Format: Convert "DD.MM.YYYY" (e.g., 14.12.2025) strictly to "YYYY-MM-DD".

            **GENERIC RULES:**
            - **Transactions**: Assign transactions only to the card section they appear in.
            - **Card Name**: Use the specific name found in the header (e.g., "DBS Woman's World Mastercard", "DBS Vantage Visa Infinite").

            Return a JSON object with a 'bills' array containing one object per card found.`,
          },
        ],
      },
      config: {
        systemInstruction: MILELION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bankName: { type: Type.STRING },
                  cardName: { type: Type.STRING },
                  totalAmount: { type: Type.NUMBER },
                  dueDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
                  statementDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
                  transactions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        date: { type: Type.STRING, description: "YYYY-MM-DD format" },
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                      },
                    },
                  },
                },
                required: ["bankName", "totalAmount", "dueDate", "transactions"],
              },
            },
          },
        },
      },
    }));

    if (response.text) {
      return JSON.parse(response.text) as AIExtractionResponse;
    }
    throw new Error("Empty response from Gemini");
  } catch (error) {
    console.error("Error extracting bill data:", error);
    throw error;
  }
};

export const generateOptimizationAdvice = async (transactions: any[]) => {
  try {
    if (!transactions || transactions.length === 0) {
        return { advice: "Upload bills to generate insights.", riskScore: 0, missedMiles: 0, anomalies: [] };
    }

    const aiClient = getAI();
    if (!aiClient) throw new Error("AI client not initialized");
    const response = await callGeminiWithRetry((model) => aiClient.models.generateContent({
      model,
      contents: `Analyze these transactions based on Singapore specific credit card strategies (Milelion).
      Identify which transactions missed a bonus mile opportunity (e.g. using a general card for online spend instead of DBS WWMC).
      
      **Advice Formatting:**
      Return the 'advice' field as a single string, but format it clearly as 3 distinct bullet points separated by newlines. Do not use markdown symbols like * or #. Start each point with a unicode bullet (•).

      **Risk Score:**
      Calculate a 'risk score' (0-100) based on potential for late fees or suboptimal card usage.
      
      Transactions JSON: ${JSON.stringify(transactions)}`,
      config: {
        systemInstruction: MILELION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            advice: { type: Type.STRING, description: "3 bullet points starting with •, separated by newlines" },
            riskScore: { type: Type.NUMBER },
            missedMiles: { type: Type.NUMBER, description: "Estimated missed miles count" },
            anomalies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of unusual transactions" }
          }
        }
      }
    }));
     if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error(error);
    return { advice: "Could not generate advice.", riskScore: 0, missedMiles: 0, anomalies: [] };
  }
};

