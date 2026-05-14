import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/courses/resolve?package=ZenAlpha+Package
 * Resolve a courseId from package name.
 * Maps package names to actual courses in the database.
 * Used by payment page when courseId is not directly available.
 */

// Package-to-course mapping
// Maps frontend package names to DB course search criteria
const PACKAGE_COURSE_MAP: Record<string, { category?: string; fallbackSearch: string }> = {
  "ZenZ Package": { category: "Programming", fallbackSearch: "Java" },
  "ZenAlpha Package": { category: "Web Dev", fallbackSearch: "MERN" },
  "ZenZ": { category: "Programming", fallbackSearch: "Java" },
  "ZenAlpha": { category: "Web Dev", fallbackSearch: "MERN" },
};

export async function GET(req: NextRequest) {
  try {
    const packageName = req.nextUrl.searchParams.get("package");

    if (!packageName?.trim()) {
      return NextResponse.json(
        { success: false, message: "Package name is required." },
        { status: 400 }
      );
    }

    const trimmed = packageName.trim();

    // Strategy 1: Direct title match in DB
    let course = await prisma.course.findFirst({
      where: {
        isActive: true,
        OR: [
          { title: { equals: trimmed, mode: "insensitive" } },
          { title: { contains: trimmed.replace(/\s*Package\s*/i, "").trim(), mode: "insensitive" } },
          { subtitle: { contains: trimmed.replace(/\s*Package\s*/i, "").trim(), mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    });

    if (course) {
      return NextResponse.json({ success: true, courseId: course.id, title: course.title });
    }

    // Strategy 2: Use package-to-course mapping
    const mapping = PACKAGE_COURSE_MAP[trimmed];
    if (mapping) {
      // Try by category first
      if (mapping.category) {
        course = await prisma.course.findFirst({
          where: { isActive: true, category: mapping.category },
          select: { id: true, title: true },
          orderBy: { createdAt: "asc" },
        });
      }

      // Fallback to search term
      if (!course) {
        course = await prisma.course.findFirst({
          where: {
            isActive: true,
            title: { contains: mapping.fallbackSearch, mode: "insensitive" },
          },
          select: { id: true, title: true },
          orderBy: { createdAt: "asc" },
        });
      }

      if (course) {
        return NextResponse.json({ success: true, courseId: course.id, title: course.title });
      }
    }

    // Strategy 3: Return first available paid course as ultimate fallback
    course = await prisma.course.findFirst({
      where: { isActive: true },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    });

    if (course) {
      return NextResponse.json({ success: true, courseId: course.id, title: course.title });
    }

    return NextResponse.json(
      { success: false, message: "No courses available." },
      { status: 404 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
