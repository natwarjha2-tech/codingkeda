-- CreateTable
CREATE TABLE "LessonHelpCache" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "helpText" TEXT NOT NULL,
    "audioBase64" TEXT,
    "voice" TEXT,
    "source" TEXT,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonHelpCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonHelpCache_kind_itemId_stage_key" ON "LessonHelpCache"("kind", "itemId", "stage");

-- CreateIndex
CREATE INDEX "LessonHelpCache_itemId_idx" ON "LessonHelpCache"("itemId");
