import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * POST /api/admin/migrate-problems
 * 
 * One-time migration: Moves the 33 hardcoded coding problems to DB.
 * Creates a dummy lesson "Coding Practice Problems" and inserts all problems as exercises.
 * SAFE: Checks for duplicates before inserting. Will NOT delete or overwrite existing data.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    // Fetch the static problems from the existing API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/coding-problems`, { cache: "no-store" });
    const data = await res.json();
    if (!data.success || !data.problems || data.problems.length === 0) {
      return NextResponse.json({ success: false, message: "Could not fetch problems." }, { status: 500 });
    }

    const problems = data.problems;

    // Check if migration already done (look for dummy lesson)
    let dummyLesson = await prisma.lesson.findFirst({
      where: { title: "Coding Practice Problems" },
    });

    if (!dummyLesson) {
      // Create a dummy module and lesson for coding practice problems
      // First find or create a "Coding Practice" course
      let practiceCourse = await prisma.course.findFirst({
        where: { title: "Coding Practice" },
      });

      if (!practiceCourse) {
        practiceCourse = await prisma.course.create({
          data: {
            title: "Coding Practice",
            subtitle: "Practice coding problems",
            category: "Practice",
            instructor: "CodingKida",
            institute: "CodingKida",
            totalHours: 0,
            totalVideos: 0,
            color: "from-purple-500 to-pink-500",
            icon: "laptop-code",
            isActive: false, // Hidden from regular users
          },
        });
      }

      // Create dummy module
      let dummyModule = await prisma.module.findFirst({
        where: { courseId: practiceCourse.id, title: "Practice Problems" },
      });

      if (!dummyModule) {
        dummyModule = await prisma.module.create({
          data: {
            courseId: practiceCourse.id,
            title: "Practice Problems",
            order: 1,
          },
        });
      }

      // Create dummy lesson
      dummyLesson = await prisma.lesson.create({
        data: {
          moduleId: dummyModule.id,
          title: "Coding Practice Problems",
          duration: "0",
          order: 1,
        },
      });
    }

    // Insert problems as exercises (skip duplicates)
    let inserted = 0;
    let skipped = 0;

    for (const p of problems) {
      // Check if already exists (by original ID stored in starterCode or title)
      const existing = await prisma.exercise.findFirst({
        where: { lessonId: dummyLesson.id, title: p.title },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create exercise
      const exercise = await prisma.exercise.create({
        data: {
          lessonId: dummyLesson.id,
          title: p.title,
          description: p.description,
          difficulty: p.difficulty,
          type: "coding",
          language: p.defaultLanguage || "c",
          starterCode: JSON.stringify(p.starterCode),
          hints: p.hints || [],
          order: inserted + 1,
          solution: JSON.stringify({
            inputFormat: p.inputFormat,
            outputFormat: p.outputFormat,
            explanation: p.explanation,
            constraints: p.constraints,
            timeComplexity: p.timeComplexity,
            spaceComplexity: p.spaceComplexity,
            category: p.category,
            tags: p.tags,
            originalId: p.id,
          }),
        },
      });

      // Create test cases
      if (p.testCases && p.testCases.length > 0) {
        for (let i = 0; i < p.testCases.length; i++) {
          const tc = p.testCases[i];
          await prisma.testCase.create({
            data: {
              exerciseId: exercise.id,
              input: tc.input || "",
              expectedOutput: tc.expectedOutput || "",
              isHidden: !!tc.isHidden,
              order: i + 1,
            },
          });
        }
      }

      inserted++;
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete. Inserted: ${inserted}, Skipped (already exists): ${skipped}`,
      lessonId: dummyLesson.id,
      totalProblems: problems.length,
    });
  } catch (err) {
    console.error("Migration error:", err);
    return NextResponse.json(
      { success: false, message: "Migration failed: " + (err instanceof Error ? err.message : "Unknown") },
      { status: 500 }
    );
  }
}
