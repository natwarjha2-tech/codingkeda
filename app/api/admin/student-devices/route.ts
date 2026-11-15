import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireSuperAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { adminUnlink, listStudentDevices } from "@/app/services/student-device.service";

/**
 * Super-admin: a student's registered devices.
 *   GET  ?q=<email or name>   → up to 10 matching students
 *   GET  ?userId=<id>         → that student's devices, history and switches left
 *   POST { userId, deviceId } → unlink one device
 *   POST { userId, all: true } → unlink all devices and reset the switch count
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = requireSuperAdmin(req);
    if (error) return error;

    const sp = req.nextUrl.searchParams;
    const userId = sp.get("userId");
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
      if (!user) return apiError(404, "Student not found.");
      return apiSuccess({ user, ...(await listStudentDevices(userId)) });
    }

    const q = (sp.get("q") ?? "").trim().slice(0, 100);
    if (q.length < 2) return apiError(400, "Type at least 2 characters.");
    const users = await prisma.user.findMany({
      where: {
        role: "user",
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return apiSuccess({ users });
  } catch (err) {
    logger.error("admin-student-devices", "get_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not load devices.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireSuperAdmin(req);
    if (error) return error;

    const body = (await req.json().catch(() => ({}))) as { userId?: unknown; deviceId?: unknown; all?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : null;
    if (!userId) return apiError(400, "userId is required.");
    if (!deviceId && body.all !== true) return apiError(400, "Send deviceId or all: true.");

    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) return apiError(404, "Student not found.");

    const count = await adminUnlink(userId, body.all === true ? null : deviceId, user!.userId);
    return apiSuccess({ unlinked: count, ...(await listStudentDevices(userId)) });
  } catch (err) {
    logger.error("admin-student-devices", "post_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not unlink the device.");
  }
}
