import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// GET /api/courses?category=Web+Dev
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    console.log('[courses/list] category:', category, '| search:', search);

    const where: Record<string, unknown> = { isActive: true };

    if (category && category !== "All") {
      where.category = category;
    }

    if (search?.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { subtitle: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const courses = await prisma.course.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        subtitle: true,
        category: true,
        instructor: true,
        institute: true,
        students: true,
        rating: true,
        totalHours: true,
        totalVideos: true,
        hasCert: true,
        color: true,
        icon: true,
        _count: { select: { modules: true } },
      },
    });

    return NextResponse.json({ success: true, courses });
  } catch (err) {
    console.error('[courses/list] FAILED:', err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
