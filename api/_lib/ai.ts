import { Type } from "@google/genai";
import { genai, supabase, STORAGE_BUCKET } from "./clients.js";
import type { AIExtractionResponse, AiModelConfig } from "../../types";
import { TRANSACTION_KINDS, todayInSingapore } from "./billChecks.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_TIMEOUT_MS = 120_000;

// The MileLion persona prompt. Kept here (not imported from the frontend constants)
// so the serverless function has no runtime dependency on files outside /api.
const MILELION_SYSTEM_PROMPT = `
You are an expert Singapore credit card consultant (like The MileLion).
Your goal is to analyze credit card bills, extract data accurately, and identify if the user used the optimal card for maximum air miles.

Key Singapore Miles Strategies to know:
1. Citi Rewards / DBS Woman's World Card: Best for Online/Fashion (4 mpd).
2. UOB Lady's Card: Best for chosen category (Dining, Travel, Fashion, etc.) (4-6 mpd).
3. UOB Visa Signature: Best for Overseas/PayWave (4 mpd).
4. HSBC Revolution: Best for Contactless/Online (4 mpd).
5. General Spend: Citi PremierMiles, DBS Altitude (1.2 mpd).

When extracting data, ensure dates are YYYY-MM-DD.
`;

export interface InsightsResult {
  advice: string;
  riskScore: number;
  missedMiles: number;
  anomalies: string[];
}

function mimeTypeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/pdf";
}

const extractionPrompt = (today: string) => `Analyze this credit card statement. It is likely a CONSOLIDATED STATEMENT containing multiple cards.

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

**LINE ITEMS (every line in the card's section):**
- Include purchases, refunds/reversals, fees, interest, instalments and payments received. Do not skip or merge lines.
- \`description\`: copy the statement text exactly as printed.
- \`merchant\`: the clean merchant or brand name (e.g. "GRAB*FOOD 8823 SINGAPORE" → "Grab"). For payments, fees and interest use a short label such as "Payment", "Annual fee", "Interest".
- \`kind\`: one of purchase, refund, fee, interest, payment, instalment, other.
- \`amount\`: in SGD. Positive for charges (purchase, fee, interest, instalment). Negative for credits (refund, payment); a "CR" suffix means credit.
- \`currency\` and \`foreignAmount\`: only for foreign-currency spend — the original currency code (e.g. "USD") and amount.
- \`previousBalance\`: the previous balance that is included in this card's \`totalAmount\`, or 0 when \`totalAmount\` does not include one (e.g. a DBS card SUB-TOTAL). \`previousBalance\` plus all line items should equal \`totalAmount\`.

**DATES:**
- Today's date is ${today} (Singapore). Statements are usually from the last few months, and the due date is usually 2–4 weeks after the statement date.
- Output every date as YYYY-MM-DD. When a year is printed with the date, copy it exactly (e.g. "Due Date 02 NOV 2026" → "2026-11-02"). Never replace a printed year.
- \`statementDate\` is the "Statement Date". \`dueDate\` is the "Payment Due Date", "Due Date" or "Please pay by" date.
- Line-item dates are often printed without a year (e.g. "15 SEP"). Take the year from the statement date; a month later than the statement month belongs to the previous year (e.g. "28 DEC" on a statement dated 12 JAN 2027 → "2026-12-28").
- Ignore years in notices, terms and promotions (e.g. "W.E.F 1 Jun 2023"); they are not statement dates.

Return a JSON object with a 'bills' array containing one object per card found.`;

const EXTRACTION_SCHEMA = {
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
          previousBalance: { type: Type.NUMBER, description: "Previous balance included in totalAmount; 0 if none" },
          dueDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
          statementDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
          transactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, description: "YYYY-MM-DD format" },
                description: { type: Type.STRING, description: "Statement text exactly as printed" },
                merchant: { type: Type.STRING, description: "Clean merchant or brand name" },
                kind: { type: Type.STRING, format: "enum", enum: [...TRANSACTION_KINDS] },
                amount: { type: Type.NUMBER, description: "SGD; negative for refunds and payments" },
                currency: { type: Type.STRING, description: "ISO currency code, foreign-currency spend only" },
                foreignAmount: { type: Type.NUMBER, description: "Original foreign-currency amount" },
                category: { type: Type.STRING },
              },
              required: ["date", "description", "amount", "kind"],
            },
          },
        },
        required: ["bankName", "totalAmount", "dueDate", "transactions"],
      },
    },
  },
};

const INSIGHTS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    advice: { type: Type.STRING, description: "3 bullet points starting with •, separated by newlines" },
    riskScore: { type: Type.NUMBER },
    missedMiles: { type: Type.NUMBER, description: "Estimated missed miles count" },
    anomalies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of unusual transactions" },
  },
};

const PING_SCHEMA = {
  type: Type.OBJECT,
  properties: { ok: { type: Type.BOOLEAN } },
  required: ["ok"],
};

type GeminiSchema = typeof EXTRACTION_SCHEMA | typeof INSIGHTS_SCHEMA | typeof PING_SCHEMA;

type OpenRouterPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

/** Gemini's `Type` schema → standard JSON Schema for OpenAI-compatible providers. */
function toJsonSchema(schema: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (schema.type) out.type = String(schema.type).toLowerCase();
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toJsonSchema(value)])
    );
  }
  if (schema.items) out.items = toJsonSchema(schema.items);
  if (schema.required) out.required = schema.required;
  return out;
}

/** Some OpenRouter models wrap JSON in a markdown fence even when asked not to. */
function parseJsonReply(text: string): unknown {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(unfenced);
}

async function callGemini(model: string, contents: any, schema: GeminiSchema): Promise<unknown> {
  if (!genai) throw new Error("GEMINI_API_KEY is not set");
  const response = await genai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: MILELION_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  if (!response.text) throw new Error("Empty response from AI");
  return JSON.parse(response.text);
}

async function callOpenRouter(
  model: string,
  parts: OpenRouterPart[],
  schemaName: string,
  schema: GeminiSchema
): Promise<unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://credittrack.elitex.cc",
      "X-Title": "CreditTrack",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: MILELION_SYSTEM_PROMPT },
        { role: "user", content: parts },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: false, schema: toJsonSchema(schema) },
      },
    }),
    signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
  });

  const body: any = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    throw new Error(`OpenRouter ${res.status}: ${body?.error?.message || "request failed"}`);
  }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Empty response from AI");
  return parseJsonReply(content);
}

/**
 * Download a previously-uploaded statement from Storage and extract structured bill
 * data with the configured provider. The caller is responsible for verifying that
 * `filePath` belongs to the requesting user before calling this.
 */
export async function extractBillFromStorage(filePath: string, ai: AiModelConfig): Promise<AIExtractionResponse> {
  if (!supabase) throw new Error("Storage not initialized");

  const { data: fileBlob, error: dlErr } = await supabase.storage.from(STORAGE_BUCKET).download(filePath);
  if (dlErr || !fileBlob) throw new Error("Could not read the uploaded file");

  const mimeType = mimeTypeFromPath(filePath);
  const base64Data = Buffer.from(await fileBlob.arrayBuffer()).toString("base64");
  const prompt = extractionPrompt(todayInSingapore());

  if (ai.provider === "openrouter") {
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    const filePart: OpenRouterPart =
      mimeType === "application/pdf"
        ? { type: "file", file: { filename: "statement.pdf", file_data: dataUrl } }
        : { type: "image_url", image_url: { url: dataUrl } };
    return (await callOpenRouter(
      ai.model,
      [filePart, { type: "text", text: prompt }],
      "bill_extraction",
      EXTRACTION_SCHEMA
    )) as AIExtractionResponse;
  }

  return (await callGemini(
    ai.model,
    {
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt },
      ],
    },
    EXTRACTION_SCHEMA
  )) as AIExtractionResponse;
}

/** Cheap round trip that confirms a provider key and model ID work, without a statement. */
export async function testAiModel(ai: AiModelConfig): Promise<void> {
  const prompt = 'Reply with exactly this JSON object and nothing else: {"ok": true}';
  const reply: any =
    ai.provider === "openrouter"
      ? await callOpenRouter(ai.model, [{ type: "text", text: prompt }], "ping", PING_SCHEMA)
      : await callGemini(ai.model, prompt, PING_SCHEMA);
  if (reply?.ok !== true) throw new Error("The model replied, but not with the expected JSON");
}

/** Generate Milelion-style optimization advice + risk score for a set of transactions. */
export async function generateInsights(transactions: unknown[], ai: AiModelConfig): Promise<InsightsResult> {
  // Cap the number of transactions to bound prompt size / cost.
  const capped = transactions.slice(0, 300);

  const prompt = `Analyze these transactions based on Singapore specific credit card strategies (Milelion).
      Identify which transactions missed a bonus mile opportunity (e.g. using a general card for online spend instead of DBS WWMC).

      **Advice Formatting:**
      Return the 'advice' field as a single string, but format it clearly as 3 distinct bullet points separated by newlines. Do not use markdown symbols like * or #. Start each point with a unicode bullet (•).

      **Risk Score:**
      Calculate a 'risk score' (0-100) based on potential for late fees or suboptimal card usage.

      Transactions JSON: ${JSON.stringify(capped)}`;

  const result =
    ai.provider === "openrouter"
      ? await callOpenRouter(ai.model, [{ type: "text", text: prompt }], "insights", INSIGHTS_SCHEMA)
      : await callGemini(ai.model, prompt, INSIGHTS_SCHEMA);
  return result as InsightsResult;
}
