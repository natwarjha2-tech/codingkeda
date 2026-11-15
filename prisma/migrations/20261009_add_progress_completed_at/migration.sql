-- Records WHEN a lesson was first completed, so the daily activity view and the
-- weekly parent report show the real completion day.
-- ADDITIVE ONLY: one new optional column. No existing column, row or table is
-- changed, dropped or truncated.
ALTER TABLE "Progress" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Fill the NEW column for lessons that are already completed, using their last
-- update time (the best date available). Only rows where completedAt is still
-- empty are touched, and only that new column is written.
UPDATE "Progress" SET "completedAt" = "updatedAt" WHERE "completed" = true AND "completedAt" IS NULL;
