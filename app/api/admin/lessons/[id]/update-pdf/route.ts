import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { deleteFileMediaS3, getS3KeyFromUrl } from "@/app/lib/s3";

/**
 * POST /api/admin/lessons/[id]/update-pdf
 * Update PDF notes URL for a specific lesson
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
    const { pdfUrl, mediaId, notes } = body;
    // Explicit "remove the PDF notes from this lesson" request.
    const removePdf = body.removePdf === true || body.delete === true;

    // Validation — allow providing a new PDF OR explicitly removing it.
    if (!pdfUrl && !mediaId && !notes && !removePdf) {
      return apiError(400, "Either pdfUrl, mediaId, notes, or removePdf is required.");
    }

    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      return apiError(404, "Lesson not found.");
    }

    // If mediaId is provided, fetch the media URL
    let finalPdfUrl = removePdf ? "" : (pdfUrl || notes);

    if (mediaId && !removePdf) {
      const media = await prisma.media.findUnique({
        where: { id: mediaId, type: "PDF" },
      });

      if (!media) {
        return apiError(404, "Media not found or not a PDF.");
      }

      finalPdfUrl = media.s3Url;
      // Activate the media record — upload is now confirmed by Save
      await prisma.media.update({ where: { id: mediaId }, data: { isActive: true } });
    }

    // ── Clean up the OLD PDF from S3 when it's being REPLACED ──
    // Only delete if the old notes URL is an S3 file that differs from the new
    // one (skip if same, or if notes wasn't an uploaded file). Non-blocking.
    const oldNotesUrl = lesson.notes || "";
    var oldKey = getS3KeyFromUrl(oldNotesUrl);
    var newKey = getS3KeyFromUrl(finalPdfUrl || "");
    if (oldKey && oldKey !== newKey) {
      try { deleteFileMediaS3(oldNotesUrl).catch(() => {}); } catch { /* never break the update */ }
    }

    // Update lesson with PDF URL in notes field
    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: { notes: finalPdfUrl || "" },
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
      message: removePdf ? "PDF notes removed." : "PDF URL updated successfully.",
      lesson: {
        id: updatedLesson.id,
        title: updatedLesson.title,
        notes: updatedLesson.notes,
        moduleId: updatedLesson.moduleId,
        moduleName: updatedLesson.module.title,
        courseId: updatedLesson.module.courseId,
      },
    });
  } catch (err) {
    console.error("Update PDF error:", err);
    return apiError(500, "Internal server error.");
  }
}
