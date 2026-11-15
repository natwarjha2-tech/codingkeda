-- Device limit (1 phone + 1 computer per student).
-- ADDITIVE ONLY: two new tables and their indexes. No existing table, column or
-- row is changed, dropped or truncated.

CREATE TABLE IF NOT EXISTS "StudentDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT '',
    "appVersion" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    CONSTRAINT "StudentDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentDevice_userId_deviceId_key" ON "StudentDevice"("userId", "deviceId");
CREATE INDEX IF NOT EXISTS "StudentDevice_userId_kind_idx" ON "StudentDevice"("userId", "kind");

CREATE TABLE IF NOT EXISTS "StudentDeviceEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentDeviceEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StudentDeviceEvent_userId_action_createdAt_idx" ON "StudentDeviceEvent"("userId", "action", "createdAt");
