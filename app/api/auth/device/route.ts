import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { signToken } from "@/app/lib/auth";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import {
  checkStudentDevice, claimDevice, claimErrorResponse, isStudentRole, parseDevice,
} from "@/app/services/student-device.service";

/**
 * POST /api/auth/device   body: { device: { id, kind, name, platform, appVersion } }
 *
 * Called by the apps when they start with a saved sign-in.
 *  - Token already tied to this device → checks it was not replaced/unlinked.
 *  - Older token (signed in before the device limit) → registers this device and
 *    returns a NEW token tied to it. If the account already uses another device
 *    of the same kind, returns 409 and the app sends the student to the sign-in
 *    screen (switching needs the password or email code again).
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    if (!isStudentRole(user!.role)) return apiSuccess({ ok: true });

    const body = await req.json().catch(() => ({}));
    const device = parseDevice((body as { device?: unknown }).device);
    if (!device) return apiError(400, "Device details are missing.");

    if (user!.did) {
      if (user!.did !== device.id) {
        return NextResponse.json(
          { success: false, code: "DEVICE_REVOKED", message: "Please sign in again on this device." },
          { status: 401 },
        );
      }
      const revoked = await checkStudentDevice(user);
      if (revoked) return revoked;
      return apiSuccess({ ok: true });
    }

    // Older sign-in without a device: bind it now (no switching from here).
    const claim = await claimDevice({ id: user!.userId, role: user!.role }, device, { replace: false });
    if (!claim.ok) {
      if (claim.code === "DEVICE_LIMIT") {
        return NextResponse.json(
          { success: false, code: "DEVICE_REVOKED", message: `${claim.message} Please sign in again to choose.` },
          { status: 401 },
        );
      }
      return claimErrorResponse(claim);
    }
    const dbUser = await prisma.user.findUnique({ where: { id: user!.userId }, select: { email: true, role: true } });
    if (!dbUser) return apiError(401, "Unauthorized. Please login.");
    const token = signToken({ userId: user!.userId, email: dbUser.email, role: dbUser.role, did: claim.did }, "365d");
    return apiSuccess({ ok: true, token });
  } catch (err) {
    logger.error("auth-device", "error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Internal server error.");
  }
}
