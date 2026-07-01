-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "language" TEXT,
ADD COLUMN     "memoryLimit" INTEGER DEFAULT 256,
ADD COLUMN     "timeLimit" INTEGER DEFAULT 2,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'theory';

-- AlterTable
ALTER TABLE "ExerciseSubmission" ADD COLUMN     "executionTime" INTEGER,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "memoryUsed" INTEGER,
ADD COLUMN     "output" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'submitted';

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCase_exerciseId_idx" ON "TestCase"("exerciseId");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
