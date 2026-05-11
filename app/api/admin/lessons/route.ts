import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

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
    const { moduleId, title, duration, isFree, order, videoUrl, notes } = body;

    if (!moduleId?.trim() || !title?.trim()) {
      return NextResponse.json(
        { success: false, message: "moduleId and title are required." },
        { status: 400 }
      );
    }

    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) {
      return NextResponse.json(
        { success: false, message: "Module not found." },
        { status: 404 }
      );
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

    return NextResponse.json(
      { success: true, message: "Lesson created successfully.", lesson },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create lesson error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
