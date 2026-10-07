-- CreateTable
CREATE TABLE "CodoScript" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodoScript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodoScript_key_key" ON "CodoScript"("key");

-- Seed the fixed Codo lines (same for every student). ON CONFLICT keeps the
-- migration idempotent and never clobbers edits made later via admin.
INSERT INTO "CodoScript" ("id", "key", "text", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'lesson_complete_prompt', 'Hey superstar! Tumne ye lesson almost पूरा कर लिया! Kya tum ek chhota sa quiz lena chahoge apni knowledge test karne ke liye? Aur kuch coins bhi earn karo!', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'quiz_complete_thanks', 'Shabaash! Tumne quiz complete kar liya! Mujhe tum par bahut proud feel ho raha hai. Aise hi seekhte raho, aur aage badhte raho!', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
