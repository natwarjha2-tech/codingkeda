import { NextResponse } from "next/server";

/**
 * Standardized API Response Helpers
 * 
 * Usage:
 *   import { apiSuccess, apiError } from "@/app/lib/response";
 *   return apiSuccess({ courses });
 *   return apiError(400, "Invalid input.");
 *   return apiSuccess({ user }, 201);
 */

/**
 * Return a successful JSON response
 * @param data - Response payload (merged with { success: true })
 * @param status - HTTP status code (default 200)
 */
export function apiSuccess(data: Record<string, unknown> = {}, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

/**
 * Return an error JSON response
 * @param status - HTTP status code (400, 401, 403, 404, 500, etc.)
 * @param message - Error message string
 */
export function apiError(status: number, message: string): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}
