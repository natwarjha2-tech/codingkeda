import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

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

    // Validation
    if (!pdfUrl && !mediaId && !notes) {
      return NextResponse.json(
        { success: false, message: "Either pdfUrl, mediaId, or notes is required." },
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
    let finalPdfUrl = pdfUrl || notes;

    if (mediaId) {
      const media = await prisma.media.findUnique({
        where: { id: mediaId, type: "PDF" },
      });

      if (!media) {
        return NextResponse.json(
          { success: false, message: "Media not found or not a PDF." },
          { status: 404 }
        );
      }

      finalPdfUrl = media.s3Url;
      // Activate the media record — upload is now confirmed by Save
      await prisma.media.update({ where: { id: mediaId }, data: { isActive: true } });
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

    return NextResponse.json({
      success: true,
      message: "PDF URL updated successfully.",
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
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
