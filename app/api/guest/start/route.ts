import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { apiSuccess, apiError } from "@/app/lib/response";
import { parseBody } from "@/app/lib/validation";
import { createRateLimiter } from "@/app/lib/rate-limit";
import { logger } from "@/app/lib/logger";
import { GUEST_TOKEN_TTL } from "@/app/lib/guest";
import { createGuest } from "@/app/services/guest.service";

export const runtime = "nodejs";

// Each guest is a few database rows: cap how many one network (IP) can make.
// 30/hour so a school computer lab (many kids, one internet connection) still works.
const guestLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 30 });

// lessonId: a free lesson (video / free coding question). Absent = the free code editor.
const schema = z.object({ lessonId: z.string().min(1).max(100).optional() });

/**
 * POST /api/guest/start  { lessonId? }
 * A visitor who isn't logged in opened a FREE lesson or the free code editor:
 * create a temporary guest student and return a 4-hour login for the classroom.
 * A lessonId must be a free lesson in an active course, so this can't be used
 * for paid content.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;

    let lesson: { id: string; courseId: string } | null = null;
    if (parsed.data.lessonId) {
      const row = await prisma.lesson.findUnique({
        where: { id: parsed.data.lessonId },
        select: { id: true, isFree: true, module: { select: { courseId: true, course: { select: { isActive: true } } } } },
      });
      if (!row || !row.isFree || !row.module?.course?.isActive) {
        return apiError(404, "This free lesson is not available.");
      }
      lesson = { id: row.id, courseId: row.module.courseId };
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!guestLimiter.check(ip)) {
      return apiError(429, "Too many guest visits from this network. Please sign up for free to continue.");
    }

    const user = await createGuest();
    const token = signToken({ userId: user.id, email: user.email, role: user.role }, GUEST_TOKEN_TTL);
    logger.info("guest", "started", { userId: user.id, lessonId: lesson?.id ?? "editor" });

    return apiSuccess({ token, courseId: lesson?.courseId ?? null, lessonId: lesson?.id ?? null, user: { id: user.id, name: user.name, role: user.role } }, 201);
  } catch (err) {
    logger.error("guest", "start_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not open the free lesson right now.");
  }
}
