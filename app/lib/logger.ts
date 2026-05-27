/**
 * Production Logger — Structured logging for Vercel Function Logs
 * 
 * Format: [TIMESTAMP] [LEVEL] [FUNCTION] userId=xxx action=yyy details
 * 
 * Usage:
 *   import { logger } from "@/app/lib/logger";
 *   logger.info("quiz-submit", "attempt_saved", { userId, quizId });
 *   logger.success("quiz-submit", "coins_awarded", { userId, coins: 10 });
 *   logger.error("quiz-submit", "db_write_failed", { userId, error: err.message });
 */

type LogLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR" | "DEBUG";

function formatLog(level: LogLevel, fn: string, action: string, details?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const detailStr = details
    ? " " + Object.entries(details)
        .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join(" ")
    : "";
  return `[${timestamp}] [${level}] [${fn}] action=${action}${detailStr}`;
}

export const logger = {
  info(fn: string, action: string, details?: Record<string, unknown>) {
    console.log(formatLog("INFO", fn, action, details));
  },

  success(fn: string, action: string, details?: Record<string, unknown>) {
    console.log(formatLog("SUCCESS", fn, action, details));
  },

  warn(fn: string, action: string, details?: Record<string, unknown>) {
    console.warn(formatLog("WARN", fn, action, details));
  },

  error(fn: string, action: string, details?: Record<string, unknown>) {
    console.error(formatLog("ERROR", fn, action, details));
  },

  debug(fn: string, action: string, details?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      console.log(formatLog("DEBUG", fn, action, details));
    }
  },
};
