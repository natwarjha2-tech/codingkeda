-- Final course test + certificate. ADDITIVE ONLY: three new tables and their
-- indexes. No existing table, column or row is changed or dropped.

CREATE TABLE IF NOT EXISTS "FinalTest" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "quizIds" JSONB NOT NULL,
    "passPercent" INTEGER NOT NULL DEFAULT 60,
    "timeLimitMin" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinalTest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FinalTest_courseId_key" ON "FinalTest"("courseId");

CREATE TABLE IF NOT EXISTS "FinalTestAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "quizIds" JSONB NOT NULL,
    "answers" JSONB,
    "score" INTEGER,
    "total" INTEGER NOT NULL,
    "percent" INTEGER,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    CONSTRAINT "FinalTestAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FinalTestAttempt_userId_courseId_idx" ON "FinalTestAttempt"("userId", "courseId");

CREATE TABLE IF NOT EXISTS "Certificate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_code_key" ON "Certificate"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_userId_courseId_key" ON "Certificate"("userId", "courseId");
CREATE INDEX IF NOT EXISTS "Certificate_userId_idx" ON "Certificate"("userId");
