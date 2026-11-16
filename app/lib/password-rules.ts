/**
 * Password rules. Pure functions (no server-only imports) so the sign-up form in
 * the browser and the API routes apply exactly the same checks.
 *
 * Requirements: 8 to 128 characters, with an uppercase letter, a lowercase
 * letter and a number; not one of the most common passwords; not containing the
 * part of the email before the @.
 *
 * Special characters are not required (that frustrates students without adding
 * much when combined with rate limiting and bcrypt).
 */

export const PASSWORD_HINT = "At least 8 characters, with an uppercase letter, a lowercase letter and a number.";

export function validatePassword(password: string, context?: { email?: string }): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 128) {
    return "Password must not exceed 128 characters.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }
  if (isCommonPassword(password)) {
    return "That password is too common. Choose something harder to guess.";
  }
  const local = (context?.email ?? "").split("@")[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    return "Password must not contain your email name.";
  }
  return null; // Valid
}

// Passwords people choose most often (they pass the length / upper / lower / number
// rules, so the rules alone don't stop them). Compared in lower case.
const COMMON_PASSWORDS = new Set([
  "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "p@ssword1", "qwerty123", "qwertyuiop", "abcd1234",
  "abc12345", "abcdefgh", "12345678", "123456789", "1234567890", "iloveyou", "welcome1", "welcome123", "admin123",
  "letmein1", "india123", "india@123", "codingkida", "codingkida1", "codingkida123", "student123", "student1",
  "test1234", "test@123", "master123", "login123", "changeme", "sunshine1", "princess1", "football1", "monkey123",
]);
// The same words with digits / symbols added at the end ("Password@123").
const COMMON_BASE_WORDS = new Set([
  "password", "passw0rd", "qwerty", "welcome", "iloveyou", "letmein", "admin", "student", "india", "codingkida",
  "abcd", "abcdefgh", "test", "login", "master", "changeme",
]);

export function isCommonPassword(password: string): boolean {
  const p = password.toLowerCase();
  if (COMMON_PASSWORDS.has(p)) return true;
  const base = p.replace(/[0-9!@#$%^&*._-]+$/, "");
  return base.length > 0 && COMMON_BASE_WORDS.has(base);
}
