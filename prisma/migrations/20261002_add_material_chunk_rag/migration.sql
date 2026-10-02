-- Enable pgvector (Neon supports this out of the box)
CREATE EXTENSION IF NOT EXISTS vector;

-- RAG store: study-material chunks + Gemini embeddings (text-embedding-004 => 768 dims)
CREATE TABLE "MaterialChunk" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "courseId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialChunk_pkey" PRIMARY KEY ("id")
);

-- Lookup indexes for re-indexing / cleanup and course-scoped search
CREATE INDEX "MaterialChunk_sourceType_sourceId_idx" ON "MaterialChunk" ("sourceType", "sourceId");
CREATE INDEX "MaterialChunk_courseId_idx" ON "MaterialChunk" ("courseId");

-- Approximate nearest-neighbour index for fast cosine similarity search.
-- HNSW is a good default; lists/ef settings can be tuned later as data grows.
CREATE INDEX "MaterialChunk_embedding_idx"
    ON "MaterialChunk"
    USING hnsw ("embedding" vector_cosine_ops);
