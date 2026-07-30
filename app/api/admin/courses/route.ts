import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/admin/courses
 * Fetch all courses for admin dashboard
 * Requires admin authentication
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAdmin(req);
    if (error) return error;

    // Admin sees only their own courses
    const courses = await prisma.course.findMany({
      where: { createdBy: user!.userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { modules: true, enrollments: true } },
      },
    });

    return apiSuccess({ courses });
  } catch (err) {
    console.error("Fetch admin courses error:", err);
    return apiError(500, "Internal server error.");
  }
}

/**
 * POST /api/admin/courses
 * Create a new course
 * Requires admin authentication
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAdmin(req);
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
      return apiError(400, "title, subtitle, category and instructor are required.");
    }

    const parsedHours = parseInt(totalHours ?? "0");
    const parsedVideos = parseInt(totalVideos ?? "0");

    if (isNaN(parsedHours) || parsedHours < 0 || isNaN(parsedVideos) || parsedVideos < 0) {
      return apiError(400, "Invalid totalHours or totalVideos value.");
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
        createdBy: user!.userId,
      },
    });

    return apiSuccess({ message: "Course created successfully.", course }, 201);
  } catch (err) {
    console.error("Create course error:", err);
    return apiError(500, "Internal server error.");
  }
}
