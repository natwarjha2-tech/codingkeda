import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * POST /api/admin/modules
 * Create a new module inside a course
 * Requires admin authentication
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const body = await req.json();
    const { courseId, title, order } = body;

    if (!courseId?.trim() || !title?.trim()) {
      return NextResponse.json(
        { success: false, message: "courseId and title are required." },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }

    // Auto-assign order if not provided
    let moduleOrder = parseInt(order ?? "0");
    if (!order) {
      const lastModule = await prisma.module.findFirst({
        where: { courseId },
        orderBy: { order: "desc" },
      });
      moduleOrder = (lastModule?.order ?? 0) + 1;
    }

    const module = await prisma.module.create({
      data: {
        courseId: courseId.trim(),
        title: title.trim(),
        order: moduleOrder,
      },
    });

    return NextResponse.json(
      { success: true, message: "Module created successfully.", module },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create module error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
