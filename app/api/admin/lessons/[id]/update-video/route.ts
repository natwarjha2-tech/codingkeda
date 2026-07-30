import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

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
    const { videoUrl, mediaId } = body;

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

    // Update lesson with video URL
    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: { videoUrl: finalVideoUrl },
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
