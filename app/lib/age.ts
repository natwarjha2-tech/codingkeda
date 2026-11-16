/**
 * Date-of-birth helpers. The apps store the date as a text field: the phone app
 * sends "dd-mm-yyyy", the desktop app and website send "yyyy-mm-dd". Both are
 * read here. Anything else counts as "unknown".
 */

export const ADULT_AGE = 18;

const IST_OFFSET_MS = 330 * 60 * 1000;

export interface Dob { y: number; m: number; d: number }

/** Read "dd-mm-yyyy", "dd/mm/yyyy", "yyyy-mm-dd". Null when it isn't a real calendar date. */
export function parseDob(raw?: string | null): Dob | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let hit = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (hit) {
    y = Number(hit[1]); m = Number(hit[2]); d = Number(hit[3]);
  } else {
    hit = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
    if (!hit) return null;
    d = Number(hit[1]); m = Number(hit[2]); y = Number(hit[3]);
  }
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Whole years old on `now`'s calendar day in India (IST). */
export function ageOn(dob: Dob, now: Date = new Date()): number {
  const t = new Date(now.getTime() + IST_OFFSET_MS);
  const ny = t.getUTCFullYear(), nm = t.getUTCMonth() + 1, nd = t.getUTCDate();
  let age = ny - dob.y;
  if (nm < dob.m || (nm === dob.m && nd < dob.d)) age -= 1;
  return age;
}

/** Message to show when the date can't be accepted; null when fine. */
export function dobError(raw?: string | null, now: Date = new Date()): string | null {
  const dob = parseDob(raw);
  if (!dob) return "Enter the date of birth as DD-MM-YYYY.";
  const age = ageOn(dob, now);
  if (age < 0) return "The date of birth can't be in the future.";
  if (age < 3 || age > 100) return "Please check the date of birth.";
  return null;
}

/** true = under 18, false = 18 or older, null = unknown / not a valid date. */
export function isMinorDob(raw?: string | null, now: Date = new Date()): boolean | null {
  const dob = parseDob(raw);
  if (!dob) return null;
  const age = ageOn(dob, now);
  if (age < 0 || age > 120) return null;
  return age < ADULT_AGE;
}

export function ageFromDob(raw?: string | null, now: Date = new Date()): number | null {
  const dob = parseDob(raw);
  return dob ? ageOn(dob, now) : null;
}
