import { Type } from "@google/genai";
import { genai, supabase, STORAGE_BUCKET } from "./clients";
import { MILELION_SYSTEM_PROMPT } from "../../constants";
import { AIExtractionResponse } from "../../types";

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

const EXTRACTION_PROMPT = `Analyze this credit card statement. It is likely a CONSOLIDATED STATEMENT containing multiple cards.

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
};

/**
 * Download a previously-uploaded statement from Storage and extract structured bill
 * data with Gemini. The caller is responsible for verifying that `filePath` belongs
 * to the requesting user before calling this.
 */
export async function extractBillFromStorage(filePath: string): Promise<AIExtractionResponse> {
  if (!genai) throw new Error("AI is not configured");
  if (!supabase) throw new Error("Storage not initialized");

  const { data: fileBlob, error: dlErr } = await supabase.storage.from(STORAGE_BUCKET).download(filePath);
  if (dlErr || !fileBlob) throw new Error("Could not read the uploaded file");

  const base64Data = Buffer.from(await fileBlob.arrayBuffer()).toString("base64");

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        { inlineData: { mimeType: mimeTypeFromPath(filePath), data: base64Data } },
        { text: EXTRACTION_PROMPT },
      ],
    },
    config: {
      systemInstruction: MILELION_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: EXTRACTION_SCHEMA,
    },
  });

  if (!response.text) throw new Error("Empty response from AI");
  return JSON.parse(response.text) as AIExtractionResponse;
}

/** Generate Milelion-style optimization advice + risk score for a set of transactions. */
export async function generateInsights(transactions: unknown[]): Promise<InsightsResult> {
  if (!genai) throw new Error("AI is not configured");

  // Cap the number of transactions to bound prompt size / cost.
  const capped = transactions.slice(0, 300);

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Analyze these transactions based on Singapore specific credit card strategies (Milelion).
      Identify which transactions missed a bonus mile opportunity (e.g. using a general card for online spend instead of DBS WWMC).

      **Advice Formatting:**
      Return the 'advice' field as a single string, but format it clearly as 3 distinct bullet points separated by newlines. Do not use markdown symbols like * or #. Start each point with a unicode bullet (•).

      **Risk Score:**
      Calculate a 'risk score' (0-100) based on potential for late fees or suboptimal card usage.

      Transactions JSON: ${JSON.stringify(capped)}`,
    config: {
      systemInstruction: MILELION_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          advice: { type: Type.STRING, description: "3 bullet points starting with •, separated by newlines" },
          riskScore: { type: Type.NUMBER },
          missedMiles: { type: Type.NUMBER, description: "Estimated missed miles count" },
          anomalies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of unusual transactions" },
        },
      },
    },
  });

  if (!response.text) return { advice: "Could not generate advice.", riskScore: 0, missedMiles: 0, anomalies: [] };
  return JSON.parse(response.text) as InsightsResult;
}
