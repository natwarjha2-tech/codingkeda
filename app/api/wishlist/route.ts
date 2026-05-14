import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/wishlist
 * Get all wishlisted courses for the logged-in user
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    const wishlist = await prisma.wishlist.findMany({
      where: { userId: payload.userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            subtitle: true,
            category: true,
            instructor: true,
            color: true,
            icon: true,
            rating: true,
            students: true,
            totalHours: true,
            totalVideos: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      wishlist: wishlist.map((w) => ({
        id: w.id,
        courseId: w.course.id,
        title: w.course.title,
        subtitle: w.course.subtitle,
        category: w.course.category,
        instructor: w.course.instructor,
        color: w.course.color,
        icon: w.course.icon,
        rating: w.course.rating,
        students: w.course.students,
        totalHours: w.course.totalHours,
        totalVideos: w.course.totalVideos,
        addedAt: w.createdAt,
      })),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wishlist
 * Add a course to wishlist
 * Body: { courseId }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const { courseId } = await req.json();

    if (!courseId?.trim()) {
      return NextResponse.json(
        { success: false, message: "courseId is required." },
        { status: 400 }
      );
    }

    // Verify course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }

    // Upsert to avoid duplicates
    const wishlistItem = await prisma.wishlist.upsert({
      where: { userId_courseId: { userId: payload.userId, courseId } },
      update: {},
      create: { userId: payload.userId, courseId },
    });

    return NextResponse.json({
      success: true,
      message: "Course added to wishlist.",
      wishlistId: wishlistItem.id,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wishlist
 * Remove a course from wishlist
 * Body: { courseId }
 */
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const { courseId } = await req.json();

    if (!courseId?.trim()) {
      return NextResponse.json(
        { success: false, message: "courseId is required." },
        { status: 400 }
      );
    }

    await prisma.wishlist.deleteMany({
      where: { userId: payload.userId, courseId },
    });

    return NextResponse.json({
      success: true,
      message: "Course removed from wishlist.",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
