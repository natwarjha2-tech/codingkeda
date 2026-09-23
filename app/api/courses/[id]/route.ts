import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { extractUser } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
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
        // Real enrolled-student count (purchasers), not reviewers.
        _count: { select: { enrollments: true } },
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
                pptUrl: true,
                pptContent: true,
                quizPdfUrl: true,
                exercisePdfUrl: true,
              },
            },
            materials: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                fileUrl: true,
                fileType: true,
                fileSize: true,
                order: true,
              },
            },
          },
        },
      },
    });

    if (!course) return apiError(404, "Course not found.");

    // Check if user is enrolled + get progress (parallel — both independent)
    let isEnrolled = false;
    let userProgress: string[] = [];

    const authUser = extractUser(req);
    // Admins/super-admins manage courses they may not have purchased, so they
    // must see study material regardless of enrollment (used by the admin panel).
    const isAdminUser = authUser?.role === "admin" || authUser?.role === "super-admin";
    if (authUser) {
      const [enrollment, progress] = await Promise.all([
        prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: authUser.userId, courseId: id } },
        }),
        prisma.progress.findMany({
          where: { userId: authUser.userId, completed: true },
          select: { lessonId: true },
        }),
      ]);
      isEnrolled = !!enrollment;
      userProgress = progress.map((p) => p.lessonId);
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

    // ── "Sign on play" ──
    // Previously, when signed=true, this route signed EVERY lesson's video AND
    // each of its qualities (720/480/360) up front — for large courses that was
    // hundreds of S3 signing calls + a Media lookup per lesson on a single
    // course open, making it slow and costly. Now we DON'T sign here: the course
    // response carries lesson metadata only (title, duration, isFree, notes),
    // and the client fetches the signed, ready-to-stream URL for a SINGLE lesson
    // on demand via GET /api/lessons/[id]/play when the user opens it.
    //
    // We still strip video/notes URLs from LOCKED lessons (not enrolled + not
    // free) so private S3 links never leak, and expose a `hasVideo` flag so the
    // client can show play vs lock without needing the URL.
    const signedCourse = signed
      ? {
          ...course,
          modules: course.modules.map((mod) => ({
            ...mod,
            lessons: mod.lessons.map((lesson) => {
              const canPlay = isEnrolled || lesson.isFree;
              return {
                ...lesson,
                hasVideo: !!lesson.videoUrl,
                // Never expose raw/private URLs for locked lessons.
                videoUrl: canPlay ? "" : "",   // signed on demand via /play
                notes: canPlay ? lesson.notes : "",
                mediaId: null,
                hlsMasterUrl: null,
                hlsStatus: "none",
                hlsQualities: [] as string[],
                qualityUrls: {} as Record<string, string>,
              };
            }),
          })),
        }
      : course;

    // ── Sign module study material up front (old-style batch signing) ──
    // A module has only a handful of files (typically 4–5), so signing them all
    // here on course-open is cheap and simple. Enrolled users get signed,
    // ready-to-open URLs; non-enrolled users get the material stripped out so
    // private S3 links never leak. Only runs for signed=true requests (the app).
    if (signed) {
      await Promise.all(
        signedCourse.modules.map(async (mod: any) => {
          if (!isEnrolled && !isAdminUser) {
            // Not enrolled (and not an admin) → don't expose any material URLs.
            mod.materials = [];
            return;
          }
          mod.materials = await Promise.all(
            (mod.materials ?? []).map(async (mat: any) => {
              let signedUrl = mat.fileUrl;
              const alreadySigned = mat.fileUrl?.includes("X-Amz-Signature");
              if (!alreadySigned && getS3KeyFromUrl(mat.fileUrl)) {
                try {
                  signedUrl = await getSignedFileUrlFromUrl(mat.fileUrl, 3600);
                } catch {
                  signedUrl = mat.fileUrl; // fall back on signing failure
                }
              }
              return { ...mat, fileUrl: signedUrl };
            })
          );
        })
      );
    }

    return apiSuccess({
      course: {
        ...signedCourse,
        isEnrolled,
        progressPercent,
        completedLessons: userProgress,
        // Real enrolled-student count (purchasers), for the hero "Students" stat.
        enrolledStudents: course._count?.enrollments || 0,
      },
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
