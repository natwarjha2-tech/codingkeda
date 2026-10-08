import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { MediaType } from "@prisma/client";
import { apiSuccess, apiError } from "@/app/lib/response";
import { triggerLessonPipeline } from "@/app/lib/lesson-pipeline";

/**
 * POST /api/admin/lessons
 * Create a new lesson inside a module
 * Requires admin authentication
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const body = await req.json();
    let { moduleId, title, duration, isFree, order, videoUrl, notes, mediaId, pdfMediaId } = body;

    if (!moduleId?.trim() || !title?.trim()) {
      return apiError(400, "moduleId and title are required.");
    }

    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) {
      return apiError(404, "Module not found.");
    }

    // Auto-assign order if not provided
    let lessonOrder = parseInt(order ?? "0");
    if (!order) {
      const lastLesson = await prisma.lesson.findFirst({
        where: { moduleId },
        orderBy: { order: "desc" },
      });
      lessonOrder = (lastLesson?.order ?? 0) + 1;
    }

    if (mediaId) {
      const media = await prisma.media.findUnique({
        where: { id: mediaId, type: MediaType.VIDEO },
      });
      if (media) {
        if (!videoUrl) {
          videoUrl = media.s3Url;
        }
        // Activate the media record — upload is now confirmed by Save — and
        // mark it "pending". Processing is kicked off AFTER the lesson is
        // created (below), so the lesson↔video link exists for the readable S3
        // prefix. If encoding fails, status becomes "failed" (visible to admin).
        await prisma.media.update({
          where: { id: mediaId },
          data: { isActive: true, hlsStatus: "pending" },
        });
      }
    }

    // Activate PDF media record if provided
    if (pdfMediaId) {
      await prisma.media.update({ where: { id: pdfMediaId }, data: { isActive: true } }).catch(() => {});
    }

    const lesson = await prisma.lesson.create({
      data: {
        moduleId: moduleId.trim(),
        title: title.trim(),
        duration: duration?.trim() || "00:00",
        isFree: isFree !== undefined ? Boolean(isFree) : false,
        order: lessonOrder,
        videoUrl: videoUrl?.trim() || "",
        notes: notes?.trim() || "",
      },
    });

    // Now that the lesson (and its video link) exists, kick off the full content
    // pipeline — video quality processing (if a video is attached) + quiz +
    // exercise generation — in the background on the server. Fire-and-forget so
    // the admin's Save returns instantly; the work runs after the response and
    // sends one combined notification when it settles.
    triggerLessonPipeline(lesson.id, mediaId || undefined);

    return apiSuccess({ message: "Lesson created successfully.", lesson }, 201);
  } catch (err) {
    console.error("Create lesson error:", err);
    return apiError(500, "Internal server error.");
  }
}
