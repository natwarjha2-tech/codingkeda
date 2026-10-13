import { prisma } from "@/app/lib/prisma";
import { apiSuccess } from "@/app/lib/response";
import { synthesizeSpeech } from "@/app/api/tts/route";

/**
 * GET /api/codo-scripts
 *
 * Returns the fixed Codo voice lines (same for every student) as a key→{text,audio}
 * map, e.g. { lesson_complete_prompt: { text: "...", audio: "base64mp3" }, ... }.
 *
 * These are stored in the DB (CodoScript table), NOT AI-generated, so there is
 * zero model cost. On the FIRST access for any script row that hasn't been
 * synthesized yet, this route generates the audio via synthesizeSpeech (which
 * uses ElevenLabs/Codo's cloned voice), stores it permanently in the DB, and
 * returns it. Every subsequent call serves straight from DB — ElevenLabs is
 * never called again for these lines.
 *
 * The response shape changed from { scripts: { key: text } } to
 * { scripts: { key: { text, audio } } }. Clients that only read .text still
 * work; clients that also read .audio get instant voice playback with no
 * separate /api/tts call.
 */

export const dynamic = "force-dynamic";

// Fallbacks mirror the seed. Used only if the DB row is missing.
// Two new keys: codo_solution_prefix + codo_solution_postfix — these wrap
// every Codo solution and are synthesized once then served from DB forever.
const FALLBACKS: Record<string, string> = {
  lesson_complete_prompt:
    "Hey superstar! Tumne ye lesson almost पूरा कर liya! Kya tum ek chhota sa quiz lena chahoge apni knowledge test karne ke liye? Aur kuch coins bhi earn karo!",
  quiz_complete_thanks:
    "Shabaash! Tumne quiz complete kar liya! Mujhe tum par bahut proud feel ho raha hai. Aise hi seekhte raho, aur aage badhte raho!",
  // ── Prefix/postfix that wrap every Codo solution ──────────────────────────
  // Always the same for every student. Audio generated once, stored forever.
  codo_solution_prefix:
    "Hey Codo squad! Most students got this question wrong, so don't worry at all :)",
  codo_solution_postfix:
    "Keep exploring, keep learning and keep rocking Codo squad!",
};

export async function GET() {
  // Build the scripts map starting from fallbacks.
  const scripts: Record<string, { text: string; audio: string | null }> = {};
  for (const [key, text] of Object.entries(FALLBACKS)) {
    scripts[key] = { text, audio: null };
  }

  // Merge DB rows over the fallbacks.
  let rows: { key: string; text: string; audioBase64: string | null; voice: string | null }[] = [];
  try {
    rows = await prisma.codoScript.findMany();
    for (const r of rows) {
      if (r.key && r.text) {
        scripts[r.key] = { text: r.text, audio: r.audioBase64 ?? null };
      }
    }
  } catch {
    // Table missing (pre-migration) — serve fallbacks with null audio.
  }

  // ── Lazy audio synthesis ────────────────────────────────────────────────────
  // For any script that exists in DB but has no audio yet, synthesize it now
  // (ElevenLabs → Codo's cloned voice), store it permanently, and return it.
  // This fires only once per script key — subsequent calls return stored audio.
  // We do this for ALL keys so prefix/postfix and other scripts all get voiced.
  const needsAudio = rows.filter((r) => r.key && r.text && !r.audioBase64);
  if (needsAudio.length > 0) {
    await Promise.allSettled(
      needsAudio.map(async (r) => {
        try {
          const tts = await synthesizeSpeech(r.text);
          if (!tts?.audio) return;
          await prisma.codoScript.update({
            where: { key: r.key },
            data: { audioBase64: tts.audio, voice: tts.voice },
          });
          // Update the in-response map so this request already returns the audio.
          if (scripts[r.key]) {
            scripts[r.key].audio = tts.audio;
          }
        } catch {
          // Best-effort — never break the response for a synthesis failure.
        }
      })
    );
  }

  // If the DB has no row yet for prefix/postfix, seed them now so the next
  // call hits the DB path (and gets stored audio). This auto-seeds on first
  // deploy without requiring a manual DB migration data step.
  const existingKeys = new Set(rows.map((r) => r.key));
  const missingKeys = Object.keys(FALLBACKS).filter((k) => !existingKeys.has(k));
  if (missingKeys.length > 0) {
    // Fire-and-forget: seed missing rows + synthesize audio. Best-effort.
    void (async () => {
      for (const key of missingKeys) {
        try {
          const text = FALLBACKS[key];
          const tts = await synthesizeSpeech(text);
          await prisma.codoScript.upsert({
            where: { key },
            create: { key, text, audioBase64: tts?.audio ?? null, voice: tts?.voice ?? null },
            update: { text, audioBase64: tts?.audio ?? null, voice: tts?.voice ?? null },
          });
        } catch { /* best-effort */ }
      }
    })();
  }

  // Backward-compatible shape: OLD clients read scripts[key] as a STRING
  // (the text); NEW clients read scripts[key].text + scripts[key].audio.
  // We return objects that ALSO behave like strings via valueOf/toString is
  // not reliable across JSON, so instead we return BOTH:
  //   scripts      -> { key: text }            (old string shape, unchanged)
  //   scriptsAudio -> { key: audioBase64|null } (new: audio alongside)
  // New clients merge them; old clients ignore scriptsAudio. Zero breakage.
  const scriptsText: Record<string, string> = {};
  const scriptsAudio: Record<string, string | null> = {};
  for (const key of Object.keys(scripts)) {
    scriptsText[key] = scripts[key].text;
    scriptsAudio[key] = scripts[key].audio;
  }

  return apiSuccess({ scripts: scriptsText, scriptsAudio });
}
