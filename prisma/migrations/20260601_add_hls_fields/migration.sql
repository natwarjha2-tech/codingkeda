-- Add HLS streaming fields to Media table
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "hlsMasterUrl" TEXT;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "hlsStatus" TEXT DEFAULT 'none';
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "hlsQualities" TEXT[] DEFAULT '{}';
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "hlsS3Prefix" TEXT;

CREATE INDEX IF NOT EXISTS "Media_hlsStatus_idx" ON "Media"("hlsStatus");
