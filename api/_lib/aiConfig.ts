// Which AI provider and model the backend uses for bill extraction and insights.
// The admin's choice lives in the `ai_config` table (service-role only, see
// supabase/migrations/009). API keys never live there — only in server env vars.
import { genai, supabase } from "./clients.js";
import type { AiModelConfig, AiProvider } from "../../types";

export const AI_PROVIDERS: readonly AiProvider[] = ["gemini", "openrouter"];

export const DEFAULT_AI_CONFIG: AiModelConfig = { provider: "gemini", model: "gemini-2.5-flash" };

// Shown as dropdown options in the admin panel; any other model ID can be typed in.
// OpenRouter entries must accept PDF/image input (openrouter.ai/models).
export const SUGGESTED_MODELS: Record<AiProvider, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
  openrouter: [
    "google/gemini-2.5-flash",
    "google/gemini-3.8-flash",
    "anthropic/claude-sonnet-5.5",
    "anthropic/claude-haiku-5.5",
    "openai/gpt-5-mini",
    "mistralai/mistral-medium-3.1",
  ],
};

const KEY_ENV_NAME: Record<AiProvider, string> = {
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export function providerKeyName(provider: AiProvider): string {
  return KEY_ENV_NAME[provider];
}

export function hasProviderKey(provider: AiProvider): boolean {
  if (provider === "gemini") return genai !== null;
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function providerKeyStatus(): Record<AiProvider, boolean> {
  return { gemini: hasProviderKey("gemini"), openrouter: hasProviderKey("openrouter") };
}

// Serverless instances each keep a short cache so every upload doesn't hit the DB.
// After an admin saves, other warm instances pick up the change within this window.
const CACHE_MS = 30_000;
let cached: { config: AiModelConfig; at: number } | null = null;

function isProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value);
}

/** The admin's saved choice, or the default when no row exists or it can't be read. */
export async function getStoredAiConfig(): Promise<AiModelConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  if (!supabase) return DEFAULT_AI_CONFIG;

  const { data, error } = await supabase.from("ai_config").select("provider, model").eq("id", 1).maybeSingle();
  if (error) {
    console.warn("ai_config could not be read, using the default AI model:", error.message);
    return DEFAULT_AI_CONFIG;
  }

  const config =
    data && isProvider(data.provider) && typeof data.model === "string" && data.model
      ? { provider: data.provider, model: data.model }
      : DEFAULT_AI_CONFIG;
  cached = { config, at: Date.now() };
  return config;
}

/**
 * The config AI calls should use. Falls back to the Gemini default when the saved
 * provider has no key, so removing a key never breaks uploads for everyone.
 */
export async function getActiveAiConfig(): Promise<AiModelConfig> {
  const stored = await getStoredAiConfig();
  if (hasProviderKey(stored.provider)) return stored;
  if (stored.provider !== DEFAULT_AI_CONFIG.provider) {
    console.warn(`${providerKeyName(stored.provider)} is not set — using ${DEFAULT_AI_CONFIG.model} on Gemini instead.`);
  }
  return DEFAULT_AI_CONFIG;
}

export async function saveAiConfig(config: AiModelConfig, userId: string): Promise<void> {
  if (!supabase) throw new Error("Database not initialized");
  const { error } = await supabase.from("ai_config").upsert({
    id: 1,
    provider: config.provider,
    model: config.model,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
  if (error) throw error;
  cached = { config, at: Date.now() };
}
