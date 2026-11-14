-- Parent WhatsApp number verification (one-time code). ADDITIVE ONLY: one new
-- table and its indexes. No existing table, column or row is changed or dropped.

CREATE TABLE IF NOT EXISTS "ParentPhoneVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "live" BOOLEAN NOT NULL DEFAULT false,
    "verifiedPhone" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sendsDay" TEXT,
    "sendsToday" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParentPhoneVerification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ParentPhoneVerification_userId_key" ON "ParentPhoneVerification"("userId");
CREATE INDEX IF NOT EXISTS "ParentPhoneVerification_phone_idx" ON "ParentPhoneVerification"("phone");
