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

// ---------------------------------------------------------------------------
// Embeddings (for RAG / semantic search over study material)
// ---------------------------------------------------------------------------

// Gemini embedding model. gemini-embedding-001 defaults to 3072 dims but
// supports a configurable output size; we request 768 to match the
// MaterialChunk.embedding vector(768) column. If you ever change EMBED_DIM,
// update the DB column dimension (migration) to match.
export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIM = 768;

/**
 * Embed a single piece of text into a 768-dim vector.
 *
 * - `taskType` tunes the embedding: use "RETRIEVAL_DOCUMENT" when indexing
 *   study material, and "RETRIEVAL_QUERY" when embedding a student's question.
 *   Matching the task types improves retrieval quality.
 * - Returns null on failure (never throws) so callers can degrade gracefully.
 */
export async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_QUERY",
  maxRetries = 3
): Promise<number[] | null> {
  if (!GEMINI_API_KEY) return null;
  const clean = (text || "").trim();
  if (!clean) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: clean }] },
          taskType,
          // Request 768 dims so vectors fit the vector(768) DB column.
          outputDimensionality: EMBED_DIM,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const values: number[] | undefined = data?.embedding?.values;
        if (Array.isArray(values) && values.length === EMBED_DIM) {
          // gemini-embedding-001 does NOT normalize when a reduced
          // outputDimensionality is requested, so we L2-normalize here to make
          // cosine similarity (pgvector <=>) behave correctly.
          return l2Normalize(values);
        }
        // Unexpected shape — don't retry, it won't fix itself.
        return null;
      }

      if (res.status === 429) {
        await sleep(attempt * 2000); // rate limited — back off
        continue;
      }
      if (res.status === 503 || res.status === 500) {
        await sleep(attempt * 1500); // transient — retry
        continue;
      }
      // 4xx other than 429 — won't succeed on retry.
      return null;
    } catch {
      if (attempt < maxRetries) {
        await sleep(attempt * 1500);
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Embed many texts sequentially (keeps us under free-tier rate limits).
 * Returns an array aligned with the input; failed items are null.
 */
export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = [];
  for (const t of texts) {
    out.push(await embedText(t, taskType));
    await sleep(150); // gentle pacing for the free tier
  }
  return out;
}

/** L2-normalize a vector so cosine distance equals dot-product distance. */
function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
