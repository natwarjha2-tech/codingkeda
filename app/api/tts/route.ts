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

// Escape the five XML special chars so user/AI text is safe inside SSML.
// NOTE: run cleanForSpeech() BEFORE this — cleanForSpeech turns & < > into
// words ("and"/"less than"/...), so by the time text reaches here those chars
// are already gone; this just guards any residual.
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Normalize AI/markdown text into clean, natural speech text — IDENTICAL to the
 * desktop/mobile client's _plainForSpeech so the audio we synthesize (and store
 * in the help cache) never reads emoji names ("star", "चमकता सितारा") or symbol
 * noise, and speaks math operators as words. Keeping this on the SERVER means
 * the cached audio served to later students matches what the first student
 * heard — the fix for "next user hears the emoji name".
 */
function cleanForSpeech(text: string): string {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " . Here is a code example on screen. ") // code blocks
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[_#>`]/g, "")
    // Strip emoji & pictographs so TTS never reads "star"/"rocket"/"चमकता सितारा".
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u2600-\u27BF\u2B00-\u2BFF\u2190-\u21FF\uFE0F\u200D\u20E3]/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, "")
    // Speak MATH/LOGIC operators as words so "5+4" reads "5 plus 4".
    .replace(/\+/g, " plus ")
    .replace(/(\w)\s*-\s*(\w)/g, "$1 minus $2") // minus only between terms
    .replace(/\*/g, " times ")
    .replace(/÷/g, " divided by ")
    .replace(/=/g, " equals ")
    .replace(/%/g, " percent ")
    .replace(/&&/g, " and ")
    .replace(/\|\|/g, " or ")
    .replace(/&/g, " and ")
    .replace(/</g, " less than ")
    .replace(/>/g, " greater than ")
    // Remove noisy brackets/slashes; keep sentence punctuation (. , ? !).
    .replace(/[()[\]{}|/\\~^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Synthesize speech for `text` and return { audio(base64 mp3), voice }.
 * Shared by this route AND the lesson-help route (which pre-generates and
 * stores audio in the DB cache). Uses the in-memory cache so identical text
 * isn't re-synthesized within a server session.
 *
 * Returns null when TTS is not configured or Google fails — callers then let
 * the client fall back to the browser voice.
 */
export async function synthesizeSpeech(
  text: string
): Promise<{ audio: string; voice: string } | null> {
  if (!GOOGLE_TTS_API_KEY) return null;

  // Normalize FIRST so emoji/symbols never reach the voice and the stored audio
  // matches what every student should hear.
  const clean = cleanForSpeech(text);
  if (!clean) return null;

  // Google TTS has a 5000-byte input limit; trim very long answers.
  const input = clean.length > 4500 ? clean.slice(0, 4500) : clean;
  const voice = pickVoice(input);

  const cacheKey = `${voice.name}:${input}`;
  const cached = CACHE.get(cacheKey);
  if (cached) return { audio: cached, voice: voice.name };

  // Lively <prosody> so Codo sounds energetic for kids (brighter + a touch
  // faster). XML-escape the text so stray &, <, > don't break the markup.
  const ssml = `<speak><prosody pitch="+3st" rate="108%">${escapeXml(input)}</prosody></speak>`;

  let res: Response;
  try {
    res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { ssml },
          voice: { languageCode: voice.languageCode, name: voice.name },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.04,
            pitch: 2.0,
          },
        }),
      }
    );
  } catch (e) {
    logger.warn("tts", "google_tts_network", { error: (e as Error)?.message });
    return null;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.warn("tts", "google_tts_failed", { status: res.status, detail: detail.slice(0, 200) });
    return null;
  }

  const data = await res.json();
  const audioContent: string | undefined = data?.audioContent;
  if (!audioContent) return null;

  // Store in the bounded cache (evict oldest if full).
  if (CACHE.size >= CACHE_MAX) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }
  CACHE.set(cacheKey, audioContent);

  return { audio: audioContent, voice: voice.name };
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

    const result = await synthesizeSpeech(clean);
    if (!result) return apiError(502, "TTS generation failed.");

    return apiSuccess({ audio: result.audio, voice: result.voice, cached: false });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
