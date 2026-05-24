import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { syncStudentOnEnroll } from "@/app/lib/sync-student";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    console.log('[courses/enroll] courseId:', courseId);
    if (!token) {
      console.warn('[courses/enroll] No token provided');
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }
    const payload = verifyToken(token);
    console.log('[courses/enroll] userId:', payload.userId);
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      console.warn('[courses/enroll] Course not found:', courseId);
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: payload.userId, courseId } },
      update: {},
      create: { userId: payload.userId, courseId },
    });
    await syncStudentOnEnroll(payload.userId);
    console.log('[courses/enroll] Success userId:', payload.userId, 'courseId:', courseId);
    return NextResponse.json({
      success: true,
      message: "Enrolled successfully.",
    });
  } catch (err) {
    console.error('[courses/enroll] FAILED:', err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
