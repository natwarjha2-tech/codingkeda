import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * POST /api/devices/register
 * 
 * Register or update a device push token for the authenticated user.
 * Supports multi-device: one user can have multiple active devices.
 * 
 * Body: { platform: "android"|"ios"|"desktop", pushToken?: string, deviceId: string }
 * 
 * - Upserts on (userId, deviceId) — no duplicate device records
 * - Updates pushToken + lastSeenAt on re-registration
 * - Reactivates previously deactivated devices
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const { platform, pushToken, deviceId } = await req.json();

    if (!platform || !deviceId) {
      return apiError(400, "platform and deviceId are required.");
    }

    const validPlatforms = ["android", "ios", "desktop"];
    if (!validPlatforms.includes(platform)) {
      return apiError(400, "platform must be android, ios, or desktop.");
    }

    // Upsert device — creates new or updates existing
    const device = await prisma.userDevice.upsert({
      where: {
        userId_deviceId: { userId: user!.userId, deviceId },
      },
      update: {
        pushToken: pushToken || null,
        platform,
        active: true,
        lastSeenAt: new Date(),
        tokenUpdatedAt: pushToken ? new Date() : undefined,
      },
      create: {
        userId: user!.userId,
        platform,
        pushToken: pushToken || null,
        deviceId,
        active: true,
      },
    });

    return apiSuccess({ deviceId: device.id, registered: true });
  } catch (err) {
    console.error("Device register error:", err);
    return apiError(500, "Internal server error.");
  }
}

/**
 * DELETE /api/devices/register
 * 
 * Deactivate a device (e.g., on logout).
 * Body: { deviceId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const { deviceId } = await req.json();
    if (!deviceId) return apiError(400, "deviceId is required.");

    await prisma.userDevice.updateMany({
      where: { userId: user!.userId, deviceId },
      data: { active: false },
    });

    return apiSuccess({ deactivated: true });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
