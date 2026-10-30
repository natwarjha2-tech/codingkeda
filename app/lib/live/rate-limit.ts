/**
 * CodingKida — Live Class in-memory rate limiter (ISOLATED MODULE)
 *
 * A tiny fixed-window rate limiter for the abuse-prone live routes (chat post,
 * join). The backend runs as a single long-lived Node process (EC2 + PM2), so
 * an in-memory counter is correct + sufficient here — no Redis needed. (If the
 * app ever moves to a multi-instance/serverless deploy, swap the store for a
 * shared one; the call sites stay identical.)
 *
 * Keyed by an arbitrary string (we use `userId:action`), so each user is limited
 * per-action independently and one user can never affect another.
 */

type Bucket = { count: number; resetAt: number };

// Module-level store (per process). Entries self-expire by timestamp; a periodic
// sweep keeps the map from growing unbounded under many distinct keys.
const _buckets = new Map<string, Bucket>();
let _lastSweep = 0;
const _SWEEP_EVERY_MS = 60_000;

function _sweep(now: number): void {
  if (now - _lastSweep < _SWEEP_EVERY_MS) return;
  _lastSweep = now;
  for (const [key, b] of _buckets) {
    if (b.resetAt <= now) _buckets.delete(key);
  }
}

/**
 * Fixed-window check. Returns { allowed, retryAfterMs }.
 *   - allowed=true  → the action is within the limit (counter incremented).
 *   - allowed=false → the limit is exceeded for the current window.
 *
 * @param key       unique key, e.g. `${userId}:chat`
 * @param limit     max allowed actions per window
 * @param windowMs  window length in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  _sweep(now);

  const b = _buckets.get(key);
  if (!b || b.resetAt <= now) {
    // New window.
    _buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (b.count < limit) {
    b.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  return { allowed: false, retryAfterMs: Math.max(0, b.resetAt - now) };
}
