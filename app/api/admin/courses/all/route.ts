import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireSuperAdmin } from "@/app/lib/middleware";

/**
 * GET /api/admin/courses/all
 * Super-admin only — fetch ALL courses from ALL admins with creator details
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = requireSuperAdmin(req);
    if (error) return error;

    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { modules: true, enrollments: true } },
      },
    });

    // Get creator details for all courses
    const creatorIds = [...new Set(courses.map(c => c.createdBy).filter(Boolean))] as string[];
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, email: true, role: true },
    });
    const creatorMap = new Map(creators.map(u => [u.id, u]));

    const coursesWithCreator = courses.map(c => ({
      ...c,
      creator: c.createdBy ? creatorMap.get(c.createdBy) || null : null,
    }));

    return NextResponse.json({ success: true, courses: coursesWithCreator });
  } catch (err) {
    console.error("Super admin fetch all courses error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
