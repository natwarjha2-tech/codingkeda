-- AlterTable: Add userId and enrolledCourses to Student, add updatedAt
ALTER TABLE "Student" ADD COLUMN "userId" TEXT;
ALTER TABLE "Student" ADD COLUMN "enrolledCourses" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Student" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Set updatedAt default for existing rows
UPDATE "Student" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;

-- Make updatedAt NOT NULL after backfill
ALTER TABLE "Student" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Try to link existing Student records to User by email
UPDATE "Student" s SET "userId" = u."id"
FROM "User" u WHERE s."email" = u."email" AND s."userId" IS NULL;

-- Delete orphan Student records that couldn't be linked to any User
DELETE FROM "Student" WHERE "userId" IS NULL;

-- Now make userId NOT NULL and add constraints
ALTER TABLE "Student" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE INDEX "Student_userId_idx" ON "Student"("userId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
