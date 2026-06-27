import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { deleteS3Prefix, deleteFromS3, getS3KeyFromUrl } from "@/app/lib/s3";

/**
 * DELETE /api/admin/modules/[id]
 * Permanently delete a module and all its related data:
 * - DB: lessons (cascade: quizzes, exercises, progress, homework), weeklyStreaks, achievements, coinTransactions, media
 * - S3: all videos, PDFs, quality MP4s, HLS assets for every lesson
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
        { success: false, message: "Module ID is required." },
        { status: 400 }
      );
    }

    // Verify module exists
    const mod = await prisma.module.findUnique({ where: { id } });
    if (!mod) {
      return NextResponse.json(
        { success: false, message: "Module not found." },
        { status: 404 }
      );
    }

    // Get all lessons in this module to delete their S3 files and reference data
    const lessons = await prisma.lesson.findMany({
      where: { moduleId: id },
      select: { id: true, videoUrl: true, notes: true },
    });

    const lessonIds = lessons.map((l) => l.id);

    // Delete S3 files for all lessons
    for (const lesson of lessons) {
      // Delete video
      if (lesson.videoUrl) {
        const videoKey = getS3KeyFromUrl(lesson.videoUrl);
        if (videoKey) await deleteFromS3(videoKey);

        // Find Media to get quality prefix
        const media = await prisma.media.findFirst({ where: { s3Url: lesson.videoUrl } });
        if (media) {
          if (media.hlsS3Prefix) {
            await deleteS3Prefix(`${media.hlsS3Prefix}/`);
          } else {
            await deleteS3Prefix(`qualities/${media.id}/`);
          }
          await deleteS3Prefix(`hls/${media.id}/`);
        }
      }
      // Delete PDF
      if (lesson.notes) {
        const notesKey = getS3KeyFromUrl(lesson.notes);
        if (notesKey) await deleteFromS3(notesKey);
      }
    }

    // Delete non-cascaded reference data from DB for all lessons in this module
    if (lessonIds.length > 0) {
      await prisma.weeklyStreak.deleteMany({ where: { lessonId: { in: lessonIds } } });
      await prisma.achievement.deleteMany({ where: { lessonId: { in: lessonIds } } });
      await prisma.coinTransaction.deleteMany({ where: { lessonId: { in: lessonIds } } });

      // Delete Media records matching lesson video/PDF URLs
      const allUrls = [
        ...lessons.map((l) => l.videoUrl).filter((url) => !!url),
        ...lessons.map((l) => l.notes).filter((url) => !!url),
      ];
      if (allUrls.length > 0) {
        await prisma.media.deleteMany({ where: { s3Url: { in: allUrls } } });
      }
    }

    // Also delete WeeklyStreaks that reference this moduleId directly
    await prisma.weeklyStreak.deleteMany({ where: { moduleId: id } });

    // Delete module from DB — cascade deletes all lessons, quizzes, exercises inside
    await prisma.module.delete({ where: { id } });

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
      message: `Module and all reference data deleted permanently (${lessons.length} lessons cleaned up).`,
    });
  } catch (err) {
    console.error("Delete module error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
