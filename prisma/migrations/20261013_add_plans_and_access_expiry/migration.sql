-- Plans (ZenAlpha bundle + single course) with 3-month access. ADDITIVE ONLY:
-- new nullable / defaulted columns, and Payment.courseId may be empty for future
-- ZenAlpha payments. No existing row is changed or deleted; existing enrollments
-- keep expiresAt = NULL, which means "never ends". Safe to re-run.

ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "inZenAlpha" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "source" TEXT;

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "plan" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "courseId" DROP NOT NULL;
