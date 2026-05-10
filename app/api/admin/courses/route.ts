import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * GET /api/admin/courses
 * Fetch all courses for admin dashboard
 * Requires admin authentication
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { modules: true, enrollments: true } },
      },
    });

    return NextResponse.json({ success: true, courses });
  } catch (err) {
    console.error("Fetch admin courses error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/courses
 * Create a new course
 * Requires admin authentication
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const body = await req.json();
    const {
      title,
      subtitle,
      category,
      instructor,
      institute,
      totalHours,
      totalVideos,
      hasCert,
      color,
      icon,
    } = body;

    // Required fields validation
    if (!title?.trim() || !subtitle?.trim() || !category?.trim() || !instructor?.trim()) {
      return NextResponse.json(
        { success: false, message: "title, subtitle, category and instructor are required." },
        { status: 400 }
      );
    }

    const parsedHours = parseInt(totalHours ?? "0");
    const parsedVideos = parseInt(totalVideos ?? "0");

    if (isNaN(parsedHours) || parsedHours < 0 || isNaN(parsedVideos) || parsedVideos < 0) {
      return NextResponse.json(
        { success: false, message: "Invalid totalHours or totalVideos value." },
        { status: 400 }
      );
    }

    const course = await prisma.course.create({
      data: {
        title: title.trim(),
        subtitle: subtitle.trim(),
        category: category.trim(),
        instructor: instructor.trim(),
        institute: institute?.trim() || "",
        totalHours: parsedHours,
        totalVideos: parsedVideos,
        hasCert: hasCert !== undefined ? Boolean(hasCert) : true,
        color: color?.trim() || "from-purple-500 to-pink-500",
        icon: icon?.trim() || "fa-book",
        isActive: true,
      },
    });

    return NextResponse.json(
      { success: true, message: "Course created successfully.", course },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create course error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
