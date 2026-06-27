import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { deleteLessonS3Files, deleteS3Prefix, deleteFromS3, getS3KeyFromUrl } from "@/app/lib/s3";

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
      return NextResponse.json(
        { success: false, message: "Lesson ID is required." },
        { status: 400 }
      );
    }

    // Verify lesson exists and get S3 file references
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: { id: true, videoUrl: true, notes: true },
    });
    if (!lesson) {
      return NextResponse.json(
        { success: false, message: "Lesson not found." },
        { status: 404 }
      );
    }

    // Delete video from S3
    if (lesson.videoUrl) {
      const videoKey = getS3KeyFromUrl(lesson.videoUrl);
      if (videoKey) await deleteFromS3(videoKey);

      // Find associated Media record to get quality prefix
      const media = await prisma.media.findFirst({ where: { s3Url: lesson.videoUrl } });
      if (media) {
        // Delete quality MP4s
        if (media.hlsS3Prefix) {
          await deleteS3Prefix(`${media.hlsS3Prefix}/`);
        } else {
          await deleteS3Prefix(`qualities/${media.id}/`);
        }
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
    const orphanedMedia = await prisma.media.findMany({
      where: { isActive: false },
      select: { id: true, s3Key: true },
    });
    for (const m of orphanedMedia) {
      await deleteFromS3(m.s3Key);
    }
    if (orphanedMedia.length > 0) {
      await prisma.media.deleteMany({ where: { id: { in: orphanedMedia.map((m) => m.id) } } });
    }

    return NextResponse.json({
      success: true,
      message: "Lesson and all reference data deleted permanently.",
    });
  } catch (err) {
    console.error("Delete lesson error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
