import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaKeepAlive: NodeJS.Timeout | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ── DB keep-alive (active hours only) ────────────────────────────────────────
// Neon (serverless Postgres) suspends an idle connection, so the FIRST query
// after a quiet period pays a ~1s cold reconnect — which is what made the first
// lesson "play" feel slow (measured ~1096ms on a cold /play query). On a
// long-running EC2 server we keep the connection warm with a tiny `SELECT 1`.
//
// To limit Neon "awake" hours (compute cost), we ONLY ping during the app's
// active window — 07:00–23:00 IST. Overnight the ping stops, so Neon is free to
// auto-suspend and we don't pay to keep it warm while nobody's studying. The
// first play after the quiet overnight window still pays one cold reconnect;
// every play during the day stays warm. This cuts keep-alive "awake" time ~33%.
//
// Guards: skip during build; only one interval ever (HMR / module reuse);
// errors swallowed; unref'd so it never blocks shutdown.
if (
  typeof process !== "undefined" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !globalForPrisma.prismaKeepAlive
) {
  const PING_MS = 30_000;
  const ACTIVE_START_HOUR_IST = 7;  // inclusive — 07:00 IST
  const ACTIVE_END_HOUR_IST = 23;   // exclusive — stop at 23:00 IST

  // Current hour in IST (UTC+5:30), independent of the server's own timezone
  // (EC2 is typically UTC). We shift the UTC epoch by +5h30m and read the hour.
  const istHour = (): number => {
    const istMs = Date.now() + 5.5 * 60 * 60 * 1000;
    return new Date(istMs).getUTCHours();
  };
  const inActiveWindow = (): boolean => {
    const h = istHour();
    return h >= ACTIVE_START_HOUR_IST && h < ACTIVE_END_HOUR_IST;
  };

  globalForPrisma.prismaKeepAlive = setInterval(() => {
    if (!inActiveWindow()) return; // overnight → let Neon suspend, no ping
    // $queryRaw is a cheap round-trip that keeps the Neon connection alive.
    prisma.$queryRaw`SELECT 1`.catch(() => {
      /* ignore — a transient failure must never crash the server */
    });
  }, PING_MS);
  globalForPrisma.prismaKeepAlive.unref?.();
}
