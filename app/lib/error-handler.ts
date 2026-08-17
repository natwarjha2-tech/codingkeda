import { NextRequest, NextResponse } from "next/server";
import { apiError } from "./response";
import { logger } from "./logger";

/**
 * Centralized Error Handler Wrapper
 * 
 * Wraps API route handlers with standardized error classification, logging,
 * and safe response generation. Eliminates repetitive try/catch in every route.
 * 
 * Error Classification:
 * - Prisma known errors (P2002, P2025, etc.) → 400/404/409
 * - JWT/Auth errors → 401
 * - JSON parse errors → 400
 * - Prisma connection errors → 503
 * - All others → 500 (no details leaked)
 * 
 * Usage:
 *   import { withErrorHandler } from "@/app/lib/error-handler";
 *   
 *   export const POST = withErrorHandler("payment-create", async (req) => {
 *     // ... route logic (no try/catch needed)
 *     return apiSuccess({ order });
 *   });
 */

type RouteHandler = (
  req: NextRequest,
  context?: unknown
) => Promise<NextResponse>;

/**
 * Wrap a route handler with centralized error handling.
 * @param routeName - Identifier for logging (e.g., "quiz-submit", "auth-login")
 * @param handler - The route handler function
 * @returns Wrapped handler with error classification
 */
export function withErrorHandler(routeName: string, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context?: unknown) => {
    const requestId = req.headers.get("x-request-id") || "unknown";
    try {
      // Entry log — minimal request metadata with correlation ID
      logger.info(routeName, "request_received", {
        method: req.method,
        path: req.nextUrl.pathname,
        requestId,
      });

      return await handler(req, context);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const message = error.message || "";
      const errorName = error.name || "";

      // ─── Prisma Known Request Errors ───
      if (errorName === "PrismaClientKnownRequestError" || "code" in error) {
        const prismaCode = (error as { code?: string }).code;

        // P2002: Unique constraint violation
        if (prismaCode === "P2002") {
          logger.warn(routeName, "duplicate_entry", { error: message });
          return apiError(409, "Resource already exists.");
        }

        // P2025: Record not found (update/delete on non-existent)
        if (prismaCode === "P2025") {
          logger.warn(routeName, "record_not_found", { error: message });
          return apiError(404, "Resource not found.");
        }

        // P2003: Foreign key constraint violation
        if (prismaCode === "P2003") {
          logger.warn(routeName, "foreign_key_violation", { error: message });
          return apiError(400, "Invalid reference. Related resource does not exist.");
        }

        // P2014: Required relation violation
        if (prismaCode === "P2014") {
          logger.warn(routeName, "relation_violation", { error: message });
          return apiError(400, "Invalid data. Required relation missing.");
        }
      }

      // ─── Prisma Connection/Infrastructure Errors ───
      if (
        errorName === "PrismaClientInitializationError" ||
        errorName === "PrismaClientRustPanicError" ||
        message.includes("Can't reach database") ||
        message.includes("Connection refused") ||
        message.includes("ECONNREFUSED")
      ) {
        logger.error(routeName, "database_unavailable", { error: message });
        return apiError(503, "Service temporarily unavailable. Please try again.");
      }

      // ─── JWT / Authentication Errors ───
      if (
        message.includes("jwt") ||
        message.includes("token") ||
        message.includes("JsonWebTokenError") ||
        message.includes("TokenExpiredError") ||
        errorName === "JsonWebTokenError" ||
        errorName === "TokenExpiredError"
      ) {
        logger.warn(routeName, "auth_error", { error: message });
        return apiError(401, "Authentication failed. Please login again.");
      }

      // ─── JSON Parse Errors (malformed request body) ───
      if (
        message.includes("JSON") ||
        message.includes("Unexpected token") ||
        message.includes("is not valid JSON") ||
        errorName === "SyntaxError"
      ) {
        logger.warn(routeName, "invalid_json", { error: message });
        return apiError(400, "Invalid request body.");
      }

      // ─── Validation Errors (Zod, custom) ───
      if (errorName === "ZodError") {
        logger.warn(routeName, "validation_error", { error: message });
        return apiError(400, "Validation failed. Check your input.");
      }

      // ─── Rate Limit (fetch to external services) ───
      if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) {
        logger.warn(routeName, "external_rate_limit", { error: message });
        return apiError(429, "Service is busy. Please try again later.");
      }

      // ─── Timeout Errors ───
      if (message.includes("timeout") || message.includes("ETIMEDOUT") || message.includes("ESOCKETTIMEDOUT")) {
        logger.error(routeName, "timeout", { error: message });
        return apiError(504, "Request timed out. Please try again.");
      }

      // ─── Generic / Unknown Errors (never leak details) ───
      logger.error(routeName, "unhandled_error", {
        requestId,
        error: message,
        stack: process.env.NODE_ENV !== "production" ? error.stack?.split("\n").slice(0, 3).join(" | ") : undefined,
      });
      return apiError(500, "Internal server error.");
    }
  };
}
