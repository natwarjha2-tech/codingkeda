-- Parental consent for students under 18 (parent email one-time code + verification
-- deadline). ADDITIVE ONLY: one new table and its indexes. No existing table,
-- column or row is changed or dropped. Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "ParentConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "email" TEXT,
    "codeHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedEmail" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sendsDay" TEXT,
    "sendsToday" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParentConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ParentConsent_userId_key" ON "ParentConsent"("userId");
CREATE INDEX IF NOT EXISTS "ParentConsent_email_idx" ON "ParentConsent"("email");
