import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { deleteVideoMediaS3, getS3KeyFromUrl } from "@/app/lib/s3";
import { triggerLessonPipeline } from "@/app/lib/lesson-pipeline";
import { cancelVideoProcessing } from "@/app/lib/video-processor";

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
    // Explicit "remove the video from this lesson" request (keeps the lesson,
    // clears its video + resets duration/views/likes to zero).
    const removeVideo = body.removeVideo === true || body.delete === true;

    // Validation — allow either providing a new video OR explicitly removing it.
    if (!videoUrl && !mediaId && !removeVideo) {
      return apiError(400, "Either videoUrl, mediaId, or removeVideo is required.");
    }

    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      return apiError(404, "Lesson not found.");
    }

    // If mediaId is provided, fetch the media URL
    let finalVideoUrl = removeVideo ? "" : videoUrl;

    if (mediaId && !removeVideo) {
      const media = await prisma.media.findUnique({
        where: { id: mediaId, type: "VIDEO" },
      });

      if (!media) {
        return apiError(404, "Media not found or not a video.");
      }

      finalVideoUrl = media.s3Url;
      // Activate the media record — upload is now confirmed by Save — and mark
      // "pending" so the background video worker auto-generates qualities.
      await prisma.media.update({ where: { id: mediaId }, data: { isActive: true, hlsStatus: "pending" } });
    }

    // Does the video actually change? (replace with a different file, or remove)
    const oldVideoUrl = lesson.videoUrl || "";
    const videoChanged =
      removeVideo ||
      (!!finalVideoUrl && getS3KeyFromUrl(oldVideoUrl) !== getS3KeyFromUrl(finalVideoUrl));

    // ── Clean up the OLD video from S3 when it's being REPLACED or REMOVED ──
    // Only delete if the old video URL exists and differs (never delete when
    // re-saving the same video). Non-blocking.
    if (oldVideoUrl && videoChanged) {
      try {
        const oldKey = getS3KeyFromUrl(oldVideoUrl);
        const oldMedia = oldKey
          ? await prisma.media.findFirst({ where: { s3Key: oldKey }, select: { id: true, hlsS3Prefix: true } })
          : null;
        // Cancel any in-flight/queued quality processing for the OLD video so it
        // stops wasting CPU and never writes stale qualities over the new one.
        if (oldMedia?.id) cancelVideoProcessing(oldMedia.id);
        // Fire-and-forget; do not block the save on S3 cleanup. Pass the mediaId
        // so qualities are removed even when hlsS3Prefix was never stored (video
        // deleted/replaced before processing finished).
        deleteVideoMediaS3(oldVideoUrl, oldMedia?.hlsS3Prefix || null, oldMedia?.id || null).catch(() => {});
      } catch { /* cleanup must never break the update */ }
    }

    // When the video is REMOVED or REPLACED with a different one, the old
    // engagement no longer belongs to the (now-different/absent) video:
    //   - removed  → duration resets to "00:00", views 0, likes/dislikes cleared
    //   - replaced → duration follows the new video (client-supplied), views 0,
    //                likes/dislikes cleared (fresh video, fresh stats)
    // Re-saving the SAME video leaves duration/views/likes untouched.
    const resetStats = videoChanged;

    // Resolve the duration to store.
    let durationToSet: string | undefined;
    if (removeVideo) {
      durationToSet = "00:00"; // no video → zero duration
    } else if (typeof duration === "string" && duration.trim()) {
      durationToSet = duration.trim(); // new video's real duration
    } else if (videoChanged) {
      durationToSet = "00:00"; // replaced but no duration sent → don't keep the old one
    } // else: same video, keep existing duration

    // Update lesson with video URL, duration, and reset stats when appropriate.
    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        videoUrl: finalVideoUrl,
        ...(durationToSet !== undefined ? { duration: durationToSet } : {}),
        ...(resetStats ? { viewCount: 0 } : {}),
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

    // Clear like/dislike reactions when the video changed (separate table).
    if (resetStats) {
      await prisma.lessonReaction.deleteMany({ where: { lessonId } });
    }

    // Kick off the full content pipeline (background, server): video quality
    // processing for the newly-set video (only when a new video was attached,
    // not a remove) plus quiz + exercise generation for this lesson. One
    // combined notification is sent when it settles. Fire-and-forget.
    // forceVideo when the video actually changed → the processor wipes any
    // partial/old qualities and re-encodes the new file from scratch.
    triggerLessonPipeline(
      lessonId,
      (mediaId && !removeVideo) ? mediaId : undefined,
      { forceVideo: videoChanged },
    );

    return apiSuccess({
      message: removeVideo
        ? "Video removed. Duration, views and likes reset."
        : videoChanged
          ? "Video updated. Duration set and views/likes reset."
          : "Video URL updated successfully.",
      lesson: {
        id: updatedLesson.id,
        title: updatedLesson.title,
        videoUrl: updatedLesson.videoUrl,
        duration: updatedLesson.duration,
        viewCount: updatedLesson.viewCount,
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
