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
export function validatePassword(password: string): string | null {
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
  return null; // Valid
}

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

/** Password schema (length only — use validatePassword() for full strength check) */
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters.").max(128);

/** UUID string schema */
export const uuidSchema = z.string().uuid("Invalid ID format.");

/** Non-empty trimmed string */
export const requiredString = z.string().min(1, "This field is required.").transform(s => s.trim());
