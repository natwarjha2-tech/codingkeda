import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { apiSuccess, apiError } from "@/app/lib/response";

// GET /api/courses?category=Web+Dev&search=python
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { isActive: true };
    if (category && category !== "All") where.category = category;
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
        id: true, title: true, subtitle: true, category: true, instructor: true, institute: true,
        students: true, rating: true, totalHours: true, totalVideos: true, hasCert: true, color: true, icon: true,
        // Real counts: enrolled students (purchasers) + lesson ids (for real
        // lesson count and feedback-rating aggregation). Duration is detected
        // client-side from the video files (DB lesson.duration is unreliable),
        // exactly like the course-detail page.
        _count: { select: { modules: true, enrollments: true } },
        modules: {
          select: {
            lessons: { select: { id: true, duration: true } },
          },
        },
      },
    });

    // Gather the set of lessonIds we care about.
    const lessonIdSet = new Set<string>();
    for (const c of courses) {
      for (const m of c.modules) {
        for (const l of m.lessons) lessonIdSet.add(l.id);
      }
    }

    // Fetch survey responses and match by lessonId in memory. Prisma's JSON
    // `path` filter does not support `in`, so we filter in JS (survey rows are
    // small — only the answers JSON is selected).
    const surveys = lessonIdSet.size
      ? await prisma.surveyResponse.findMany({ select: { answers: true } })
      : [];

    // Aggregate rating sum + count per lesson (in memory).
    const perLesson: Record<string, { sum: number; count: number }> = {};
    for (const s of surveys) {
      const a = s.answers as { lessonId?: string; rating?: number } | null;
      if (a && a.lessonId && lessonIdSet.has(a.lessonId) && a.rating) {
        const r = Math.min(5, Math.max(1, Math.round(a.rating)));
        if (!perLesson[a.lessonId]) perLesson[a.lessonId] = { sum: 0, count: 0 };
        perLesson[a.lessonId].sum += r;
        perLesson[a.lessonId].count += 1;
      }
    }

    // Parse a stored lesson duration into seconds. Supports plain seconds
    // ("109"), "MM:SS" ("1:49"), and "HH:MM:SS". Unset values ("00:00"/"0"/"")
    // contribute 0.
    const durToSeconds = (d: string | null | undefined): number => {
      if (!d) return 0;
      const s = String(d).trim();
      if (!s || s === "00:00" || s === "0") return 0;
      if (s.indexOf(":") === -1) {
        const n = parseInt(s, 10);
        return isNaN(n) ? 0 : n;
      }
      const parts = s.split(":").map((x) => parseInt(x, 10));
      if (parts.some((n) => isNaN(n))) return 0;
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parts[0] || 0;
    };

    const coursesWithCounts = courses.map((c) => {
      let lessonCount = 0;
      let totalDurationSeconds = 0;
      let ratingSum = 0;
      let ratedLessons = 0;
      for (const m of c.modules) {
        for (const l of m.lessons) {
          lessonCount += 1;
          totalDurationSeconds += durToSeconds(l.duration);
          const pl = perLesson[l.id];
          if (pl && pl.count > 0) {
            ratingSum += pl.sum / pl.count; // this lesson's avg
            ratedLessons += 1;
          }
        }
      }
      // Course rating = average of rated lessons' averages (matches detail page).
      const feedbackRating =
        ratedLessons > 0
          ? Math.round((ratingSum / ratedLessons) * 10) / 10
          : 0;

      const { modules: _modules, _count, ...rest } = c;
      void _modules;
      return {
        ...rest,
        // Prefer real feedback rating; fall back to stored course.rating.
        rating: feedbackRating > 0 ? feedbackRating : (c.rating || 0),
        _count: { modules: _count?.modules || 0 },
        enrolledStudents: _count?.enrollments || 0,
        lessonCount,
        // Real total duration (seconds) from stored lesson durations.
        totalDurationSeconds,
      };
    });

    return apiSuccess({ courses: coursesWithCounts });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
