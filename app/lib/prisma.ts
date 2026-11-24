import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// No DB keep-alive ping.
// A `SELECT 1` every 30s (07:00–23:00 IST) stopped Neon from ever auto-suspending,
// which alone used ~120 CU-hours/month — more than the whole free allowance — even
// with no students online. Neon now suspends after 5 idle minutes and wakes on the
// next request (that one request takes ~0.5–1s longer); real traffic keeps it awake.
