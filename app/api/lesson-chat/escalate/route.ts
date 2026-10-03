import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { escalateToExpert } from "@/app/lib/lesson-chat";

/**
 * POST /api/lesson-chat/escalate
 * Body: { lessonId }
 *
 * "Connect with our Expert" — a student (or instructor) explicitly requests a
 * human expert for this lesson. Posts a confirmation into the thread and
 * notifies the course instructor. Access is enforced in the service.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const { lessonId } = await req.json();
    if (!lessonId?.trim()) return apiError(400, "lessonId is required.");

    const sender = await prisma.user.findUnique({
      where: { id: user!.userId },
      select: { name: true },
    });

    const result = await escalateToExpert({
      lessonId: lessonId.trim(),
      requesterId: user!.userId,
      requesterName: sender?.name || "A student",
    });

    if (!result.ok) {
      return apiError(result.status, result.message || "Failed to connect with expert.");
    }
    return apiSuccess({ message: result.data }, 201);
  } catch (err) {
    console.error("Lesson chat escalate error:", err);
    return apiError(500, "Internal server error.");
  }
}
