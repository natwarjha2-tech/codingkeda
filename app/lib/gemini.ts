/**
 * Centralized Gemini AI Client
 * 
 * Provides a single function to call Gemini API with:
 * - Model fallback chain (2.5-flash → 2.0-flash → 2.0-flash-lite)
 * - Rate limit retry (429 → backoff)
 * - JSON response parsing (strips markdown code blocks)
 * - Configurable temperature & token limits
 * 
 * Usage:
 *   import { callGemini, callGeminiJSON } from "@/app/lib/gemini";
 *   const text = await callGemini("Your prompt here");
 *   const data = await callGeminiJSON<MyType>("Generate JSON...", { temperature: 0.3 });
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

export interface GeminiConfig {
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
  responseMimeType?: string;
}

const DEFAULT_CONFIG: GeminiConfig = {
  temperature: 0.4,
  maxOutputTokens: 4096,
  maxRetries: 3,
};

/**
 * Call Gemini and return raw text response.
 * Handles retries (429), model fallback, and errors.
 * Returns empty string on failure (never throws).
 */
export async function callGemini(
  prompt: string,
  config: GeminiConfig = {}
): Promise<string> {
  if (!GEMINI_API_KEY) return "";

  const opts = { ...DEFAULT_CONFIG, ...config };
  const maxRetries = opts.maxRetries || 3;

  for (const model of MODEL_CHAIN) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const generationConfig: Record<string, unknown> = {
          temperature: opts.temperature,
          maxOutputTokens: opts.maxOutputTokens,
        };
        if (opts.responseMimeType) {
          generationConfig.responseMimeType = opts.responseMimeType;
        }

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) return text;
        } else if (res.status === 429) {
          // Rate limited — wait and retry
          await sleep(attempt * 2000);
          continue;
        } else if (res.status === 503 || res.status === 500) {
          // Model unavailable — try next model
          break;
        } else {
          break;
        }
      } catch {
        if (attempt < maxRetries) {
          await sleep(attempt * 1500);
          continue;
        }
        break;
      }
    }
  }

  return "";
}

/**
 * Call Gemini and parse response as JSON.
 * Automatically strips markdown code blocks (```json ... ```).
 * Returns null on failure (never throws).
 */
export async function callGeminiJSON<T = unknown>(
  prompt: string,
  config: GeminiConfig = {}
): Promise<T | null> {
  const rawText = await callGemini(prompt, config);
  if (!rawText) return null;

  try {
    const cleaned = rawText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Check if Gemini API key is configured
 */
export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
