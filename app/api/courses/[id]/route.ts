import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                duration: true,
                isFree: true,
                order: true,
                notes: true,
                videoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }

    // Check if user is enrolled (optional — works without token too)
    let isEnrolled = false;
    let userProgress: string[] = [];

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token) {
      try {
        const payload = verifyToken(token);

        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: payload.userId, courseId: id } },
        });
        isEnrolled = !!enrollment;

        // Get completed lesson IDs for this user
        const progress = await prisma.progress.findMany({
          where: { userId: payload.userId, completed: true },
          select: { lessonId: true },
        });
        userProgress = progress.map((p) => p.lessonId);
      } catch {
        // Invalid token — continue without user context
      }
    }

    // Calculate overall progress
    const allLessons = course.modules.flatMap((m) => m.lessons);
    const totalLessons = allLessons.length;
    const completedCount = allLessons.filter((l) =>
      userProgress.includes(l.id)
    ).length;
    const progressPercent =
      totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    return NextResponse.json({
      success: true,
      course: {
        ...course,
        isEnrolled,
        progressPercent,
        completedLessons: userProgress,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
