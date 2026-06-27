import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { deleteS3Prefix, deleteFromS3, getS3KeyFromUrl } from "@/app/lib/s3";

/**
 * DELETE /api/admin/courses/[id]
 * Permanently delete a course and ALL related data:
 * - DB: modules, lessons (cascade: quizzes, exercises, progress, homework),
 *       enrollments, payments (cascade), weeklyStreaks, achievements, coinTransactions, media
 * - S3: all videos, PDFs, quality MP4s, HLS assets for every lesson
 * Requires admin authentication + ownership check.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = requireAdmin(req);
    if (error) return error;

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Course ID is required." },
        { status: 400 }
      );
    }

    // Verify course exists and belongs to this admin
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }

    if (course.createdBy !== user!.userId && user!.role !== "super-admin") {
      return NextResponse.json(
        { success: false, message: "You can only delete your own courses." },
        { status: 403 }
      );
    }

    // Get all lessons across all modules in this course
    const lessons = await prisma.lesson.findMany({
      where: { module: { courseId: id } },
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

    // Delete non-cascaded reference data from DB
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

    // Also delete WeeklyStreaks and CoinTransactions/Achievements that reference courseId
    await prisma.weeklyStreak.deleteMany({ where: { courseId: id } });
    await prisma.coinTransaction.deleteMany({ where: { courseId: id } });
    await prisma.achievement.deleteMany({ where: { courseId: id } });

    // Delete EnrollTokens for this course (no cascade relation)
    await prisma.enrollToken.deleteMany({ where: { courseId: id } });

    // Delete course from DB — Prisma cascade handles: modules, lessons, quizzes, exercises,
    // progress, homework, enrollments, payments
    await prisma.course.delete({ where: { id } });

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
      message: `Course and all reference data deleted permanently (${lessons.length} lessons cleaned up).`,
    });
  } catch (err) {
    console.error("Delete course error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
