/**
 * In-Memory Rate Limiter (Reusable)
 * 
 * Works on both Vercel (serverless — per instance) and EC2 (persistent).
 * For serverless: acts as per-invocation soft limit (not globally accurate but prevents burst abuse).
 * For EC2: fully accurate since single process.
 * 
 * Usage:
 *   import { createRateLimiter } from "@/app/lib/rate-limit";
 *   const limiter = createRateLimiter({ windowMs: 60000, max: 10 });
 *   if (!limiter.check(userId)) return apiError(429, "Rate limit exceeded.");
 */

export interface RateLimitConfig {
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
  /** Maximum requests per window (default: 10) */
  max?: number;
  /** Auto-cleanup interval in ms (default: 5 minutes) */
  cleanupIntervalMs?: number;
}

export interface RateLimiter {
  /** Returns true if request allowed, false if rate limited */
  check(key: string): boolean;
  /** Reset a specific key (e.g. after successful action) */
  reset(key: string): void;
}

/**
 * Create a reusable rate limiter instance
 */
export function createRateLimiter(config: RateLimitConfig = {}): RateLimiter {
  const windowMs = config.windowMs || 60_000;
  const max = config.max || 10;
  const cleanupIntervalMs = config.cleanupIntervalMs || 5 * 60_000;

  const store = new Map<string, { count: number; resetAt: number }>();

  // Periodic cleanup to prevent memory leaks
  if (typeof setInterval !== "undefined") {
    setInterval(() => {
      const now = Date.now();
      store.forEach((entry, key) => {
        if (now > entry.resetAt) store.delete(key);
      });
    }, cleanupIntervalMs);
  }

  return {
    check(key: string): boolean {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (entry.count >= max) return false;
      entry.count++;
      return true;
    },

    reset(key: string): void {
      store.delete(key);
    },
  };
}
