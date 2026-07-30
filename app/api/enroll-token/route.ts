import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { syncStudentOnEnroll } from "@/app/lib/sync-student";
import { randomBytes } from "crypto";

/**
 * POST /api/enroll-token
 * Generate a one-time enrollment token after payment
 * Requires valid user token
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const { courseId } = await req.json();
    if (!courseId?.trim()) return apiError(400, "courseId is required.");

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return apiError(404, "Course not found.");

    // Generate secure one-time token
    const enrollToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.enrollToken.create({
      data: { token: enrollToken, userId: user!.userId, courseId, expiresAt },
    });

    return apiSuccess({ enrollToken });
  } catch {
    return apiError(500, "Internal server error.");
  }
}

/**
 * GET /api/enroll-token?token=xxx
 * Verify and consume enrollment token — enroll user in course
 * No auth required — token itself is the proof
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return apiError(400, "Token is required.");

    const record = await prisma.enrollToken.findUnique({ where: { token } });
    if (!record) return apiError(400, "Invalid token.");
    if (record.used) return apiError(400, "Token already used.");
    if (new Date() > record.expiresAt) return apiError(400, "Token expired.");

    // Mark token as used
    await prisma.enrollToken.update({ where: { token }, data: { used: true } });

    // Enroll user in course
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: record.userId, courseId: record.courseId } },
      update: {},
      create: { userId: record.userId, courseId: record.courseId },
    });

    // Sync Student record
    await syncStudentOnEnroll(record.userId);

    return apiSuccess({ message: "Enrolled successfully.", courseId: record.courseId });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
