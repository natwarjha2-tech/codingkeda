-- Add audio columns to CodoScript so prefix/postfix audio is generated once
-- and stored permanently — never re-synthesized.
ALTER TABLE "CodoScript" ADD COLUMN "audioBase64" TEXT;
ALTER TABLE "CodoScript" ADD COLUMN "voice" TEXT;
