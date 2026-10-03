import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";

/**
 * POST /api/tts
 * Body: { text: string }
 *
 * Text-to-speech for Codo's voice using Google Cloud Text-to-Speech.
 * - Voice MATCHES the answer language (Option 2): Hindi text -> hi-IN male
 *   voice; otherwise en-IN (Indian-English) male voice. This keeps the spoken
 *   audio natural for whatever language Codo answered in.
 * - Returns base64 MP3 which the client plays as a data: URL.
 * - In-memory cache keyed by (voice + text) so the SAME answer is never
 *   regenerated (controls cost — kids often tap "Listen" repeatedly).
 *
 * Requires GOOGLE_TTS_API_KEY (a Google *Cloud* key with Cloud Text-to-Speech
 * API enabled — this is NOT the Gemini key). If unset, returns 503 and the
 * client falls back to the browser's built-in voice.
 */

const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY || "";

// Male Neural2 voices. Devanagari text -> Hindi voice; else Indian-English.
const HINDI_VOICE = { languageCode: "hi-IN", name: "hi-IN-Neural2-B" };
const ENGLISH_VOICE = { languageCode: "en-IN", name: "en-IN-Neural2-B" };

// Simple in-memory LRU-ish cache (process-lifetime). Keeps generated audio so
// identical text isn't re-synthesized. Bounded to avoid unbounded memory use.
const CACHE = new Map<string, string>(); // key -> base64 audio
const CACHE_MAX = 500;

function pickVoice(text: string) {
  // If the text contains Devanagari characters, use the Hindi voice.
  return /[\u0900-\u097F]/.test(text) ? HINDI_VOICE : ENGLISH_VOICE;
}

export async function POST(req: NextRequest) {
  try {
    const { error } = requireAuth(req);
    if (error) return error;

    if (!GOOGLE_TTS_API_KEY) {
      // Not configured — client will use the browser voice fallback.
      return apiError(503, "TTS not configured.");
    }

    const { text } = await req.json();
    const clean = (text || "").toString().trim();
    if (!clean) return apiError(400, "text is required.");

    // Google TTS has a 5000-byte input limit; trim very long answers.
    const input = clean.length > 4500 ? clean.slice(0, 4500) : clean;
    const voice = pickVoice(input);

    const cacheKey = `${voice.name}:${input}`;
    const cached = CACHE.get(cacheKey);
    if (cached) {
      return apiSuccess({ audio: cached, voice: voice.name, cached: true });
    }

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: input },
          voice: { languageCode: voice.languageCode, name: voice.name },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 0.96, // a touch slower for kids
            pitch: 0,
          },
        }),
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.warn("tts", "google_tts_failed", { status: res.status, detail: detail.slice(0, 200) });
      // Let the client fall back to the browser voice.
      return apiError(502, "TTS generation failed.");
    }

    const data = await res.json();
    const audioContent: string | undefined = data?.audioContent;
    if (!audioContent) return apiError(502, "TTS returned no audio.");

    // Store in the bounded cache (evict oldest if full).
    if (CACHE.size >= CACHE_MAX) {
      const firstKey = CACHE.keys().next().value;
      if (firstKey) CACHE.delete(firstKey);
    }
    CACHE.set(cacheKey, audioContent);

    return apiSuccess({ audio: audioContent, voice: voice.name, cached: false });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
