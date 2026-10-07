import { prisma } from "@/app/lib/prisma";
import { apiSuccess } from "@/app/lib/response";

/**
 * GET /api/codo-scripts
 *
 * Returns the fixed Codo voice lines (same for every student) as a key→text
 * map, e.g. { lesson_complete_prompt: "...", quiz_complete_thanks: "..." }.
 *
 * These are stored in the DB (CodoScript table), NOT AI-generated, so there is
 * zero model cost. Clients render the text and voice it via /api/tts (which
 * caches the audio), so the whole feature costs nothing per student.
 *
 * Hardcoded fallbacks are returned if the table is empty (e.g. before the
 * migration runs) so the feature never breaks.
 */

export const dynamic = "force-dynamic";

// Fallbacks mirror the seed in the migration. Used only if the row is missing.
const FALLBACKS: Record<string, string> = {
  lesson_complete_prompt:
    "Hey superstar! Tumne ye lesson almost पूरा कर लिया! Kya tum ek chhota sa quiz lena chahoge apni knowledge test karne ke liye? Aur kuch coins bhi earn karo!",
  quiz_complete_thanks:
    "Shabaash! Tumne quiz complete kar liya! Mujhe tum par bahut proud feel ho raha hai. Aise hi seekhte raho, aur aage badhte raho!",
};

export async function GET() {
  const scripts: Record<string, string> = { ...FALLBACKS };
  try {
    const rows = await prisma.codoScript.findMany();
    for (const r of rows) {
      if (r.key && r.text) scripts[r.key] = r.text;
    }
  } catch {
    // Table missing (pre-migration) or DB hiccup — serve the fallbacks so the
    // client feature keeps working.
  }
  return apiSuccess({ scripts });
}
