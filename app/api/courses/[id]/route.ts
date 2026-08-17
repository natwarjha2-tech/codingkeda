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
          },
        },
      },
    });

    if (!course) return apiError(404, "Course not found.");

    // Check if user is enrolled + get progress (parallel — both independent)
    let isEnrolled = false;
    let userProgress: string[] = [];

    const authUser = extractUser(req);
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

                  // Look up HLS info from Media table by matching s3Url
                  let mediaId = null;
                  let hlsMasterUrl = null;
                  let hlsStatus = 'none';
                  let hlsQualities: string[] = [];
                  let qualityUrls: Record<string, string> = {};
                  if (lesson.videoUrl) {
                    const s3KeyRaw = getS3KeyFromUrl(lesson.videoUrl);
                    const media = s3KeyRaw ? await prisma.media.findFirst({
                      where: { s3Key: s3KeyRaw, isActive: true },
                      select: { id: true, hlsMasterUrl: true, hlsStatus: true, hlsQualities: true, hlsS3Prefix: true },
                    }) : null;
                    if (media) {
                      mediaId = media.id;
                      hlsStatus = media.hlsStatus || 'none';
                      hlsQualities = media.hlsQualities || [];
                      // Generate signed URLs for each quality MP4 in parallel
                      if (media.hlsStatus === 'ready' && media.hlsS3Prefix && hlsQualities.length > 0) {
                        const qualityEntries = await Promise.all(
                          hlsQualities.map(async (q) => {
                            const qKey = `${media.hlsS3Prefix}/${q}.mp4`;
                            const url = await getSignedFileUrlFromUrl(
                              `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${qKey}`,
                              3600
                            );
                            return [q, url] as const;
                          })
                        );
                        for (const [q, url] of qualityEntries) {
                          qualityUrls[q] = url;
                        }
                      }
                    }
                  }

                  return {
                    ...lesson,
                    videoUrl: signedVideoUrl,
                    notes: lesson.notes,
                    mediaId,
                    hlsMasterUrl,
                    hlsStatus,
                    hlsQualities,
                    qualityUrls,
                  };
                }
                // For locked lessons, return empty URLs
                return {
                  ...lesson,
                  videoUrl: "",
                  notes: "",
                  mediaId: null,
                  hlsMasterUrl: null,
                  hlsStatus: 'none',
                  hlsQualities: [],
                };
              })
            ),
          }))
        ),
      };
    }

    return apiSuccess({
      course: {
        ...signedCourse,
        isEnrolled,
        progressPercent,
        completedLessons: userProgress,
      },
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
