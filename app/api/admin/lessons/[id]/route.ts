import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { deleteS3Prefix, deleteFromS3, getS3KeyFromUrl, deleteQualitiesByMediaId } from "@/app/lib/s3";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * PATCH /api/admin/lessons/[id]
 * Update specific fields of a lesson (quizPdfUrl, exercisePdfUrl, etc.)
 * Requires admin authentication.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { id } = await params;
    const body = await req.json();

    if (!id) {
      return apiError(400, "Lesson ID is required.");
    }

    // Only allow safe fields to be updated
    const allowedFields = ["quizPdfUrl", "exercisePdfUrl", "title"];
    const updateData: Record<string, string> = {};
    for (const field of allowedFields) {
      if (field in body && typeof body[field] === "string") {
        updateData[field] = body[field];
      }
    }

    // Title (when provided) is trimmed and must not be empty — a lesson always
    // needs a name. URL fields keep their existing pass-through behaviour.
    if ("title" in updateData) {
      const trimmed = updateData.title.trim();
      if (!trimmed) return apiError(400, "Lesson title cannot be empty.");
      updateData.title = trimmed;
    }

    if (Object.keys(updateData).length === 0) {
      return apiError(400, "No valid fields to update.");
    }

    await prisma.lesson.update({
      where: { id },
      data: updateData,
    });

    return apiSuccess({ message: "Lesson updated." });
  } catch (err) {
    console.error("Patch lesson error:", err);
    return apiError(500, "Internal server error.");
  }
}

/**
 * DELETE /api/admin/lessons/[id]
 * Permanently delete a lesson and all its related data:
 * - DB: quizzes, exercises, progress, homework (cascade), weeklyStreak, achievements, coinTransactions, media
 * - S3: video, PDF/notes, quality MP4s, HLS assets
 * Requires admin authentication.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { id } = await params;

    if (!id) {
      return apiError(400, "Lesson ID is required.");
    }

    // Verify lesson exists and get S3 file references
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: { id: true, videoUrl: true, notes: true },
    });
    if (!lesson) {
      return apiError(404, "Lesson not found.");
    }

    // Delete video from S3
    if (lesson.videoUrl) {
      const videoKey = getS3KeyFromUrl(lesson.videoUrl);
      if (videoKey) await deleteFromS3(videoKey);

      // Find associated Media record to clean up its processed qualities. Use
      // the stored prefix when present, and ALWAYS also sweep by mediaId — the
      // real quality prefix is qualities/<course>/<module>/<slug>-<mediaId>, so
      // the old `qualities/<mediaId>/` fallback never matched and orphaned files.
      const media = await prisma.media.findFirst({ where: { s3Url: lesson.videoUrl } });
      if (media) {
        if (media.hlsS3Prefix) await deleteS3Prefix(`${media.hlsS3Prefix}/`);
        await deleteQualitiesByMediaId(media.id);
        // Delete HLS assets
        await deleteS3Prefix(`hls/${media.id}/`);
      }
    }

    // Delete PDF/notes from S3
    if (lesson.notes) {
      const notesKey = getS3KeyFromUrl(lesson.notes);
      if (notesKey) await deleteFromS3(notesKey);
    }

    // Delete non-cascaded reference data from DB
    await prisma.weeklyStreak.deleteMany({ where: { lessonId: id } });
    await prisma.achievement.deleteMany({ where: { lessonId: id } });
    await prisma.coinTransaction.deleteMany({ where: { lessonId: id } });

    // Delete Media records for this lesson (video + PDF)
    if (lesson.videoUrl) {
      await prisma.media.deleteMany({ where: { s3Url: lesson.videoUrl } });
    }
    if (lesson.notes) {
      await prisma.media.deleteMany({ where: { s3Url: lesson.notes } });
    }

    // Delete lesson from DB — cascade deletes quizzes, exercises, progress, homework
    await prisma.lesson.delete({ where: { id } });

    // Safety net: clean up any orphaned inactive Media records (uploaded but never saved)
    // Safety net: ONLY stale, never-saved uploads (inactive AND >1 hour old).
    // The age gate prevents wiping in-use media (e.g. study-material PDFs) whose
    // Media row happens to be inactive — the bug that deleted PDFs from S3.
    const _oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const orphanedMedia = await prisma.media.findMany({
      where: { isActive: false, createdAt: { lt: _oneHourAgo } },
      select: { id: true, s3Key: true },
    });
    for (const m of orphanedMedia) {
      await deleteFromS3(m.s3Key);
    }
    if (orphanedMedia.length > 0) {
      await prisma.media.deleteMany({ where: { id: { in: orphanedMedia.map((m) => m.id) } } });
    }

    return apiSuccess({
      message: "Lesson and all reference data deleted permanently.",
    });
  } catch (err) {
    console.error("Delete lesson error:", err);
    return apiError(500, "Internal server error.");
  }
}
