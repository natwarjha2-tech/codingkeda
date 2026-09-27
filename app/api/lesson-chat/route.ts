import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import {
  getLessonMessages,
  postLessonMessage,
  resolveLessonContext,
} from "@/app/lib/lesson-chat";

/**
 * GET /api/lesson-chat?lessonId=...&after=<ISO?>
 * Fetch a lesson's group Q&A chat messages (oldest → newest).
 * Access: the course instructor OR an enrolled student.
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const lessonId = req.nextUrl.searchParams.get("lessonId")?.trim();
    const after = req.nextUrl.searchParams.get("after")?.trim() || undefined;
    if (!lessonId) return apiError(400, "lessonId is required.");

    const ctx = await resolveLessonContext(lessonId);
    if (!ctx) return apiError(404, "Lesson not found.");

    // Access check: instructor of the course, or an enrolled student.
    const isInstructor = !!ctx.instructorUserId && ctx.instructorUserId === user!.userId;
    let allowed = isInstructor;
    if (!allowed) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user!.userId, courseId: ctx.courseId } },
        select: { id: true },
      });
      allowed = !!enrollment;
    }
    if (!allowed) return apiError(403, "You don't have access to this lesson chat.");

    const messages = await getLessonMessages(lessonId, { after, viewerId: user!.userId });

    return apiSuccess({
      messages,
      isInstructor,
      courseId: ctx.courseId,
      lessonTitle: ctx.lessonTitle,
      courseTitle: ctx.courseTitle,
    });
  } catch (err) {
    console.error("Lesson chat GET error:", err);
    return apiError(500, "Internal server error.");
  }
}

/**
 * POST /api/lesson-chat
 * Body: { lessonId, text, parentId? }
 * Send a message. Role (student/instructor) + access enforced in the service.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const { lessonId, text, parentId } = await req.json();
    if (!lessonId?.trim()) return apiError(400, "lessonId is required.");

    // Sender display name (JWT has no name — fetch once).
    const sender = await prisma.user.findUnique({
      where: { id: user!.userId },
      select: { name: true },
    });

    const result = await postLessonMessage({
      lessonId: lessonId.trim(),
      senderId: user!.userId,
      senderName: sender?.name || "User",
      text,
      parentId,
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to send message.");
    return apiSuccess({ message: result.data }, 201);
  } catch (err) {
    console.error("Lesson chat POST error:", err);
    return apiError(500, "Internal server error.");
  }
}
