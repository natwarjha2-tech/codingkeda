-- Account deletion requests (student-initiated, 30-day grace period).
-- ADDITIVE ONLY: one new table and its indexes. No existing table, column or
-- row is changed, dropped or truncated by this migration.

CREATE TABLE IF NOT EXISTS "AccountDeletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL DEFAULT '',
    "requestedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "codeAttempts" INTEGER NOT NULL DEFAULT 0,
    "codeSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountDeletion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccountDeletion_userId_key" ON "AccountDeletion"("userId");
CREATE INDEX IF NOT EXISTS "AccountDeletion_status_scheduledFor_idx" ON "AccountDeletion"("status", "scheduledFor");
