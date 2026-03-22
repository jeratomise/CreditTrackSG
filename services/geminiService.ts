
import { GoogleGenAI, Type } from "@google/genai";
import { MILELION_SYSTEM_PROMPT } from "../constants";
import { AIExtractionResponse } from "../types";

let ai: GoogleGenAI | null = null;

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

export const extractBillData = async (base64Data: string, mimeType: string = "image/png"): Promise<AIExtractionResponse> => {
  try {
    const aiClient = getAI();
    if (!aiClient) throw new Error("AI client not initialized");
    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
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
    });

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
    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
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
    });
     if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error(error);
    return { advice: "Could not generate advice.", riskScore: 0, missedMiles: 0, anomalies: [] };
  }
};

