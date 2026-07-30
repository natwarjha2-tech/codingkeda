import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * POST /api/admin/lessons/[id]/update-ppt
 * Update PPT URL for a specific lesson
 * Requires admin authentication
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { id: lessonId } = await params;
    const body = await req.json();
    const { pptUrl, mediaId, pptContent } = body;

    if (!pptUrl && !mediaId) {
      return apiError(400, "Either pptUrl or mediaId is required.");
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      return apiError(404, "Lesson not found.");
    }

    let finalPptUrl = pptUrl;

    if (mediaId) {
      const media = await prisma.media.findUnique({
        where: { id: mediaId },
      });
      if (!media) {
        return apiError(404, "Media not found.");
      }
      finalPptUrl = media.s3Url;
      await prisma.media.update({ where: { id: mediaId }, data: { isActive: true } });
    }

    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: { pptUrl: finalPptUrl || "", ...(pptContent && { pptContent }) },
    });

    return apiSuccess({
      message: "PPT URL updated successfully.",
      lesson: { id: updatedLesson.id, pptUrl: updatedLesson.pptUrl },
    });
  } catch (err) {
    console.error("Update PPT error:", err);
    return apiError(500, "Internal server error.");
  }
}
