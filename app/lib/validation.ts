/**
 * Shared Validation Utilities
 * 
 * Reusable validation functions for request data.
 * Used across signup, change-password, reset-password, and all routes with Zod.
 */

import { z } from "zod";
import { apiError } from "./response";
import { NextResponse } from "next/server";

/**
 * Validate password strength.
 * Returns null if valid, or an error message string if invalid.
 * 
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * 
 * Does NOT require special characters (reduces user frustration without
 * significantly impacting security when combined with rate limiting + bcrypt).
 */
// The rules live in a pure file so the sign-up form in the browser applies the
// same checks (also: not a common password, not containing the email name).
// Re-exported here so existing imports keep working.
export { validatePassword, isCommonPassword } from "./password-rules";

/**
 * Parse and validate request body against a Zod schema.
 * Returns either the validated data or an API error response.
 * 
 * Usage:
 *   const result = await parseBody(req, mySchema);
 *   if (result.error) return result.error;
 *   const { name, email } = result.data;
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      // Extract first meaningful error message
      const firstError = parsed.error.errors[0];
      const field = firstError.path.length > 0 ? firstError.path.join(".") : "";
      const message = field
        ? `${field}: ${firstError.message}`
        : firstError.message;
      return { error: apiError(400, message) };
    }

    return { data: parsed.data };
  } catch {
    return { error: apiError(400, "Invalid request body.") };
  }
}

// ─── Common Zod Schemas (reusable across routes) ───

/** Email validation schema */
export const emailSchema = z.string().email("Invalid email format.").max(255);

/**
 * Quick boolean email-format check (reuses `emailSchema`).
 * For routes that do manual (non-Zod) validation — avoids duplicating an
 * email regex. Trims before checking so leading/trailing spaces don't fail.
 */
export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse((email ?? "").trim()).success;
}

/** Password schema (length only — use validatePassword() for full strength check) */
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters.").max(128);

/** UUID string schema */
export const uuidSchema = z.string().uuid("Invalid ID format.");

/** Non-empty trimmed string */
export const requiredString = z.string().min(1, "This field is required.").transform(s => s.trim());
