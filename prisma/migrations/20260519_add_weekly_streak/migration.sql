-- CreateTable
CREATE TABLE "WeeklyStreak" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyStreakAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streakId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyStreakAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyStreak_lessonId_key" ON "WeeklyStreak"("lessonId");

-- CreateIndex
CREATE INDEX "WeeklyStreak_courseId_idx" ON "WeeklyStreak"("courseId");

-- CreateIndex
CREATE INDEX "WeeklyStreak_moduleId_idx" ON "WeeklyStreak"("moduleId");

-- CreateIndex
CREATE INDEX "WeeklyStreakAttempt_userId_idx" ON "WeeklyStreakAttempt"("userId");

-- CreateIndex
CREATE INDEX "WeeklyStreakAttempt_streakId_idx" ON "WeeklyStreakAttempt"("streakId");

-- AddForeignKey
ALTER TABLE "WeeklyStreakAttempt" ADD CONSTRAINT "WeeklyStreakAttempt_streakId_fkey" FOREIGN KEY ("streakId") REFERENCES "WeeklyStreak"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyStreakAttempt" ADD CONSTRAINT "WeeklyStreakAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
