// Iterative prompt testing harness for the bill extractor.
// Reads a PDF, sends it to Gemini with the production prompt, prints
// the structured JSON, and diffs against ground truth.
//
// Usage: node scripts/test-extraction.mjs <pdf-path> [--prompt promptFile.txt]

import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Set GEMINI_API_KEY in environment.");
  process.exit(1);
}

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node test-extraction.mjs <pdf-path> [--prompt promptFile]");
  process.exit(1);
}

const promptArgIdx = process.argv.indexOf("--prompt");
const promptFile = promptArgIdx >= 0 ? process.argv[promptArgIdx + 1] : null;
const modelArgIdx = process.argv.indexOf("--model");
const MODEL = modelArgIdx >= 0 ? process.argv[modelArgIdx + 1] : "gemini-2.5-flash";

const SYSTEM_PROMPT = `
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

const DEFAULT_USER_PROMPT = `Analyze this credit card statement. It is likely a CONSOLIDATED STATEMENT containing multiple cards.

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

const userPrompt = promptFile
  ? fs.readFileSync(promptFile, "utf8")
  : DEFAULT_USER_PROMPT;

console.log(`Reading: ${pdfPath}`);
const data = fs.readFileSync(pdfPath);
const base64Data = data.toString("base64");
const sizeKB = Math.round(data.length / 1024);
console.log(`Size: ${sizeKB} KB, base64: ${Math.round(base64Data.length / 1024)} KB`);

const ai = new GoogleGenAI({ apiKey });

const start = Date.now();
console.log("Calling Gemini...");

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function withRetry(fn, attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (e) {
      const transient = [429, 500, 502, 503, 504].includes(e?.status);
      if (!transient || i === attempts) throw e;
      const delay = 2000 * i + Math.floor(Math.random() * 800);
      console.log(`  attempt ${i} failed (${e.status}). Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

console.log(`Model: ${MODEL}`);
const response = await withRetry(() => ai.models.generateContent({
  model: MODEL,
  contents: {
    parts: [
      { inlineData: { mimeType: "application/pdf", data: base64Data } },
      { text: userPrompt },
    ],
  },
  config: {
    systemInstruction: SYSTEM_PROMPT,
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

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`Response in ${elapsed}s\n`);

const parsed = JSON.parse(response.text);
const summary = parsed.bills.map((b, i) => ({
  i,
  bank: b.bankName,
  card: b.cardName,
  total: b.totalAmount,
  due: b.dueDate,
  stmt: b.statementDate,
  txns: b.transactions?.length ?? 0,
}));
console.table(summary);

console.log("\n--- Full JSON ---");
console.log(JSON.stringify(parsed, null, 2));
