/**
 * Display-name check for sign-up and the profile. Stops the usual junk:
 * email addresses used as names ("abc@gmail.com"), digits, one-letter names and
 * placeholders ("test", "abc", "user").
 */

// Built with the RegExp constructor so it works with the project's ES2017 target.
const NAME_CHARS = new RegExp("^[\\p{L}\\p{M}][\\p{L}\\p{M} .'’-]*$", "u");
const LETTER = new RegExp("[\\p{L}]", "gu");

const PLACEHOLDERS = new Set([
  "test", "testing", "abc", "abcd", "abcde", "xyz", "user", "username", "student", "name", "your name", "full name",
  "admin", "demo", "asdf", "asd", "qwerty", "na", "none", "null", "undefined", "unknown", "nothing", "hello", "hi",
]);

export const NAME_MESSAGE = "Enter your real name: letters only, 2 to 50 characters (no email address or numbers).";

/** Tidy spaces: trims and collapses repeated spaces. */
export function cleanName(raw?: string | null): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

/** Error message when the name can't be accepted; null when it is fine. */
export function validateName(raw?: string | null): string | null {
  const name = cleanName(raw);
  if (name.length < 2 || name.length > 50) return NAME_MESSAGE;
  if (!NAME_CHARS.test(name)) return NAME_MESSAGE;
  const letters = name.match(LETTER);
  if (!letters || letters.length < 2) return NAME_MESSAGE;
  if (PLACEHOLDERS.has(name.toLowerCase())) return NAME_MESSAGE;
  if (/(.)\1{3,}/u.test(name)) return NAME_MESSAGE; // "aaaa", "hhhhh"
  return null;
}
