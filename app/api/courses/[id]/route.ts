import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";

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

    const signed = req.nextUrl.searchParams.get("signed") === "true";

    // Calculate overall progress
    const allLessons = course.modules.flatMap((m) => m.lessons);
    const totalLessons = allLessons.length;
    const completedCount = allLessons.filter((l) =>
      userProgress.includes(l.id)
    ).length;
    const progressPercent =
      totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    let signedCourse = course;
    if (signed) {
      // Sign video URLs for enrolled users OR free lessons
      signedCourse = {
        ...course,
        modules: await Promise.all(
          course.modules.map(async (mod) => ({
            ...mod,
            lessons: await Promise.all(
              mod.lessons.map(async (lesson) => {
                // Sign video URL if user is enrolled OR lesson is free
                if (isEnrolled || lesson.isFree) {
                  // Skip signing if already a signed URL
                  const alreadySigned = lesson.videoUrl?.includes('X-Amz-Signature');
                  const signedVideoUrl = (!alreadySigned && getS3KeyFromUrl(lesson.videoUrl))
                    ? await getSignedFileUrlFromUrl(lesson.videoUrl)
                    : lesson.videoUrl;
                  return {
                    ...lesson,
                    videoUrl: signedVideoUrl,
                    notes: lesson.notes,
                  };
                }
                // For locked lessons, return empty URLs
                return {
                  ...lesson,
                  videoUrl: "",
                  notes: "",
                };
              })
            ),
          }))
        ),
      };
    }

    return NextResponse.json({
      success: true,
      course: {
        ...signedCourse,
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
