import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { extractUser } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";

/**
 * GET /api/lessons/[id]/play
 *
 * "Sign on play" — returns the signed, ready-to-stream data for a SINGLE lesson,
 * generated only when the user actually opens that lesson. This replaces the old
 * behaviour where GET /api/courses/[id]?signed=true signed EVERY lesson (and each
 * of its qualities) in a course upfront — which, for large courses, meant
 * hundreds of signing operations + DB lookups on a single course open.
 *
 * Access: the user must be enrolled in the lesson's course OR the lesson must be
 * free. Locked lessons return empty URLs (never a signed URL).
 *
 * Response shape mirrors exactly what the video players already consume from the
 * course-detail response, so the clients can drop this in with minimal change:
 *   { success, lesson: { id, title, notes, videoUrl, mediaId, hlsMasterUrl,
 *                        hlsStatus, hlsQualities, qualityUrls, isFree } }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params;
    if (!lessonId) return apiError(400, "Lesson id is required.");

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        title: true,
        notes: true,
        videoUrl: true,
        isFree: true,
        module: { select: { courseId: true } },
      },
    });
    if (!lesson) return apiError(404, "Lesson not found.");

    const courseId = lesson.module?.courseId;

    // Access check: enrolled in the course OR the lesson is free.
    let isEnrolled = false;
    const authUser = extractUser(req);
    if (authUser && courseId) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: authUser.userId, courseId } },
      });
      isEnrolled = !!enrollment;
    }

    const canAccess = isEnrolled || lesson.isFree;
    if (!canAccess) {
      // Locked — no playable URL (client shows the paywall).
      return apiSuccess({
        lesson: {
          id: lesson.id,
          title: lesson.title,
          notes: "",
          videoUrl: "",
          mediaId: null,
          hlsMasterUrl: null,
          hlsStatus: "none",
          hlsQualities: [] as string[],
          qualityUrls: {} as Record<string, string>,
          isFree: lesson.isFree,
          locked: true,
        },
      });
    }

    // Sign the original video URL (skip if already signed).
    const alreadySigned = lesson.videoUrl?.includes("X-Amz-Signature");
    const signedVideoUrl =
      !alreadySigned && getS3KeyFromUrl(lesson.videoUrl)
        ? await getSignedFileUrlFromUrl(lesson.videoUrl)
        : lesson.videoUrl;

    // HLS / quality info from the Media table (matched by the video's s3Key).
    let mediaId: string | null = null;
    let hlsStatus = "none";
    let hlsQualities: string[] = [];
    const qualityUrls: Record<string, string> = {};
    if (lesson.videoUrl) {
      const s3KeyRaw = getS3KeyFromUrl(lesson.videoUrl);
      const media = s3KeyRaw
        ? await prisma.media.findFirst({
            where: { s3Key: s3KeyRaw, isActive: true },
            select: { id: true, hlsStatus: true, hlsQualities: true, hlsS3Prefix: true },
          })
        : null;
      if (media) {
        mediaId = media.id;
        hlsStatus = media.hlsStatus || "none";
        hlsQualities = media.hlsQualities || [];
        if (media.hlsStatus === "ready" && media.hlsS3Prefix && hlsQualities.length > 0) {
          const entries = await Promise.all(
            hlsQualities.map(async (q) => {
              const qKey = `${media.hlsS3Prefix}/${q}.mp4`;
              const url = await getSignedFileUrlFromUrl(
                `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${qKey}`,
                3600
              );
              return [q, url] as const;
            })
          );
          for (const [q, url] of entries) qualityUrls[q] = url;
        }
      }
    }

    return apiSuccess({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        notes: lesson.notes,
        videoUrl: signedVideoUrl,
        mediaId,
        hlsMasterUrl: null,
        hlsStatus,
        hlsQualities,
        qualityUrls,
        isFree: lesson.isFree,
        locked: false,
      },
    });
  } catch (err) {
    console.error("Lesson play error:", err);
    return apiError(500, "Internal server error.");
  }
}
