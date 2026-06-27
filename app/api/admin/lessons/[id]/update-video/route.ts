import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

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
      return NextResponse.json(
        { success: false, message: "Either videoUrl or mediaId is required." },
        { status: 400 }
      );
    }

    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      return NextResponse.json(
        { success: false, message: "Lesson not found." },
        { status: 404 }
      );
    }

    // If mediaId is provided, fetch the media URL
    let finalVideoUrl = videoUrl;

    if (mediaId) {
      const media = await prisma.media.findUnique({
        where: { id: mediaId, type: "VIDEO" },
      });

      if (!media) {
        return NextResponse.json(
          { success: false, message: "Media not found or not a video." },
          { status: 404 }
        );
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

    return NextResponse.json({
      success: true,
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
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
