-- Phase 2: Add coding interface support to Exercise model
-- This migration adds type system, language support, and test cases

-- Add new fields to Exercise table (all with defaults so existing rows are unaffected)
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'theory';
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "timeLimit" INTEGER DEFAULT 2;
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "memoryLimit" INTEGER DEFAULT 256;

-- Add new fields to ExerciseSubmission table
ALTER TABLE "ExerciseSubmission" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "ExerciseSubmission" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'submitted';
ALTER TABLE "ExerciseSubmission" ADD COLUMN IF NOT EXISTS "executionTime" INTEGER;
ALTER TABLE "ExerciseSubmission" ADD COLUMN IF NOT EXISTS "memoryUsed" INTEGER;
ALTER TABLE "ExerciseSubmission" ADD COLUMN IF NOT EXISTS "output" TEXT;

-- Create TestCase table
CREATE TABLE IF NOT EXISTS "TestCase" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TestCase_exerciseId_fkey'
    ) THEN
        ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_exerciseId_fkey"
            FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create index on TestCase.exerciseId
CREATE INDEX IF NOT EXISTS "TestCase_exerciseId_idx" ON "TestCase"("exerciseId");
