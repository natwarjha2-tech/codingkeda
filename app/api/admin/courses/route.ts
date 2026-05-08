import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

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
      price,
      totalHours,
      totalVideos,
      hasCert,
      color,
      icon,
    } = body;

    // Required fields validation
    if (!title?.trim() || !subtitle?.trim() || !category?.trim() || !instructor?.trim() || !institute?.trim() || !color?.trim() || !icon?.trim()) {
      return NextResponse.json(
        { success: false, message: "title, subtitle, category, instructor, institute, color and icon are required." },
        { status: 400 }
      );
    }

    const parsedPrice = parseInt(price ?? "0");
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json(
        { success: false, message: "Invalid price value." },
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
        institute: institute.trim(),
        price: parsedPrice,
        isFree: parsedPrice === 0,
        totalHours: parsedHours,
        totalVideos: parsedVideos,
        hasCert: hasCert !== undefined ? Boolean(hasCert) : true,
        color: color.trim(),
        icon: icon.trim(),
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
