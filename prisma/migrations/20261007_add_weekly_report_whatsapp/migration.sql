-- Weekly parent report on WhatsApp. ADDITIVE ONLY: two new tables and their
-- indexes. No existing table, column or row is changed or dropped.

CREATE TABLE IF NOT EXISTS "ParentReportConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'app',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParentReportConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ParentReportConsent_userId_key" ON "ParentReportConsent"("userId");

CREATE TABLE IF NOT EXISTS "WeeklyReportLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "waMessageId" TEXT,
    "toLast4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeeklyReportLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyReportLog_userId_weekStart_key" ON "WeeklyReportLog"("userId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyReportLog_createdAt_idx" ON "WeeklyReportLog"("createdAt");
