import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { deleteVideoMediaS3, getS3KeyFromUrl } from "@/app/lib/s3";

/**
 * POST /api/admin/lessons/[id]/update-video
 * Update video URL for a specific lesson
 * Requires admin authentication
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin authentication check
    const { error } = requireAdmin(req);
    if (error) return error;

    const { id: lessonId } = await params;
    const body = await req.json();
    const { videoUrl, mediaId, duration } = body;

    // Validation
    if (!videoUrl && !mediaId) {
      return apiError(400, "Either videoUrl or mediaId is required.");
    }

    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      return apiError(404, "Lesson not found.");
    }

    // If mediaId is provided, fetch the media URL
    let finalVideoUrl = videoUrl;

    if (mediaId) {
      const media = await prisma.media.findUnique({
        where: { id: mediaId, type: "VIDEO" },
      });

      if (!media) {
        return apiError(404, "Media not found or not a video.");
      }

      finalVideoUrl = media.s3Url;
      // Activate the media record — upload is now confirmed by Save
      await prisma.media.update({ where: { id: mediaId }, data: { isActive: true } });
    }

    // ── Clean up the OLD video from S3 when it's being REPLACED ──
    // Only delete if the old video URL exists and differs from the new one
    // (never delete when re-saving the same video). Non-blocking.
    const oldVideoUrl = lesson.videoUrl || "";
    if (oldVideoUrl && finalVideoUrl && getS3KeyFromUrl(oldVideoUrl) !== getS3KeyFromUrl(finalVideoUrl)) {
      try {
        const oldKey = getS3KeyFromUrl(oldVideoUrl);
        const oldMedia = oldKey
          ? await prisma.media.findFirst({ where: { s3Key: oldKey }, select: { hlsS3Prefix: true } })
          : null;
        // Fire-and-forget; do not block the save on S3 cleanup.
        deleteVideoMediaS3(oldVideoUrl, oldMedia?.hlsS3Prefix || null).catch(() => {});
      } catch { /* cleanup must never break the update */ }
    }

    // Update lesson with video URL (and real duration in seconds, if detected)
    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        videoUrl: finalVideoUrl,
        ...(typeof duration === "string" && duration.trim() ? { duration: duration.trim() } : {}),
      },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            courseId: true,
          },
        },
      },
    });

    return apiSuccess({
      message: "Video URL updated successfully.",
      lesson: {
        id: updatedLesson.id,
        title: updatedLesson.title,
        videoUrl: updatedLesson.videoUrl,
        moduleId: updatedLesson.moduleId,
        moduleName: updatedLesson.module.title,
        courseId: updatedLesson.module.courseId,
      },
    });
  } catch (err) {
    console.error("Update video error:", err);
    return apiError(500, "Internal server error.");
  }
}
