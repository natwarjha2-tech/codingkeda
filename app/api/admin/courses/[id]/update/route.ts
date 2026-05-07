import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * POST /api/admin/courses/[id]/update
 * Update course details
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

    const { id: courseId } = await params;
    const body = await req.json();

    // Check if course exists
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!existingCourse) {
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }

    // Extract and validate fields
    const {
      title,
      subtitle,
      category,
      instructor,
      institute,
      price,
      isFree,
      totalHours,
      totalVideos,
      hasCert,
      color,
      icon,
      isActive,
      rating,
      students,
    } = body;

    // Build update data object (only include provided fields)
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title.trim();
    if (subtitle !== undefined) updateData.subtitle = subtitle.trim();
    if (category !== undefined) updateData.category = category.trim();
    if (instructor !== undefined) updateData.instructor = instructor.trim();
    if (institute !== undefined) updateData.institute = institute.trim();
    if (price !== undefined) {
      const parsedPrice = parseInt(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return NextResponse.json(
          { success: false, message: "Invalid price value." },
          { status: 400 }
        );
      }
      updateData.price = parsedPrice;
      updateData.isFree = parsedPrice === 0;
    }
    if (isFree !== undefined) updateData.isFree = Boolean(isFree);
    if (totalHours !== undefined) {
      const parsedHours = parseInt(totalHours);
      if (isNaN(parsedHours) || parsedHours < 0) {
        return NextResponse.json(
          { success: false, message: "Invalid totalHours value." },
          { status: 400 }
        );
      }
      updateData.totalHours = parsedHours;
    }
    if (totalVideos !== undefined) {
      const parsedVideos = parseInt(totalVideos);
      if (isNaN(parsedVideos) || parsedVideos < 0) {
        return NextResponse.json(
          { success: false, message: "Invalid totalVideos value." },
          { status: 400 }
        );
      }
      updateData.totalVideos = parsedVideos;
    }
    if (hasCert !== undefined) updateData.hasCert = Boolean(hasCert);
    if (color !== undefined) updateData.color = color.trim();
    if (icon !== undefined) updateData.icon = icon.trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (rating !== undefined) {
      const parsedRating = parseFloat(rating);
      if (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 5) {
        return NextResponse.json(
          { success: false, message: "Invalid rating value. Must be between 0 and 5." },
          { status: 400 }
        );
      }
      updateData.rating = parsedRating;
    }
    if (students !== undefined) {
      const parsedStudents = parseInt(students);
      if (isNaN(parsedStudents) || parsedStudents < 0) {
        return NextResponse.json(
          { success: false, message: "Invalid students value." },
          { status: 400 }
        );
      }
      updateData.students = parsedStudents;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: "No valid fields provided for update." },
        { status: 400 }
      );
    }

    // Update course
    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: updateData,
      include: {
        modules: {
          select: {
            id: true,
            title: true,
            order: true,
          },
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Course updated successfully.",
      course: {
        id: updatedCourse.id,
        title: updatedCourse.title,
        subtitle: updatedCourse.subtitle,
        category: updatedCourse.category,
        instructor: updatedCourse.instructor,
        institute: updatedCourse.institute,
        price: updatedCourse.price,
        isFree: updatedCourse.isFree,
        totalHours: updatedCourse.totalHours,
        totalVideos: updatedCourse.totalVideos,
        hasCert: updatedCourse.hasCert,
        color: updatedCourse.color,
        icon: updatedCourse.icon,
        isActive: updatedCourse.isActive,
        rating: updatedCourse.rating,
        students: updatedCourse.students,
        enrollmentCount: updatedCourse._count.enrollments,
        modules: updatedCourse.modules,
        createdAt: updatedCourse.createdAt,
      },
    });
  } catch (err) {
    console.error("Update course error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
