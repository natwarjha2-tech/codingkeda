-- CreateIndex (non-destructive: only adds lookup shortcuts, no data modification)
CREATE INDEX "QuizAttempt_userId_lessonId_idx" ON "QuizAttempt"("userId", "lessonId");

-- CreateIndex (non-destructive: only adds lookup shortcuts, no data modification)
CREATE INDEX "Progress_userId_completed_idx" ON "Progress"("userId", "completed");
