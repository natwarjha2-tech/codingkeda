/**
 * SAFE Seed Script — Coding Practice Problems
 * 
 * ONLY INSERTS new data. Does NOT delete/update anything.
 * REQUIRES: npm run dev running in another terminal.
 * 
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-problems.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting safe coding problems migration...");
  console.log("⚠️  This script ONLY INSERTS — no existing data will be modified.\n");

  // Fetch problems from local running dev server
  let problems: any[];
  try {
    const res = await fetch("http://localhost:3000/api/coding-problems");
    const data = await res.json();
    if (!data.success || !data.problems) {
      console.error("❌ Could not fetch problems. Make sure 'npm run dev' is running!");
      return;
    }
    problems = data.problems;
  } catch (e) {
    console.error("❌ Cannot connect to localhost:3000. Run 'npm run dev' first!");
    return;
  }

  console.log(`📋 Found ${problems.length} problems to migrate.\n`);

  // Step 1: Create or find dummy course (hidden from users)
  let course = await prisma.course.findFirst({ where: { title: "Coding Practice" } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        title: "Coding Practice",
        subtitle: "Practice coding problems for the Code Editor",
        category: "Practice",
        instructor: "CodingKida",
        institute: "CodingKida",
        totalHours: 0,
        totalVideos: 0,
        color: "from-purple-500 to-pink-500",
        icon: "laptop-code",
        isActive: false,
      },
    });
    console.log("✅ Created 'Coding Practice' course (hidden)");
  } else {
    console.log("ℹ️  'Coding Practice' course already exists — skipping");
  }

  // Step 2: Create or find dummy module
  let mod = await prisma.module.findFirst({ where: { courseId: course.id, title: "Practice Problems" } });
  if (!mod) {
    mod = await prisma.module.create({
      data: { courseId: course.id, title: "Practice Problems", order: 1 },
    });
    console.log("✅ Created 'Practice Problems' module");
  } else {
    console.log("ℹ️  'Practice Problems' module already exists — skipping");
  }

  // Step 3: Create or find dummy lesson
  let lesson = await prisma.lesson.findFirst({ where: { moduleId: mod.id, title: "Coding Practice Problems" } });
  if (!lesson) {
    lesson = await prisma.lesson.create({
      data: { moduleId: mod.id, title: "Coding Practice Problems", duration: "0", order: 1 },
    });
    console.log("✅ Created 'Coding Practice Problems' lesson\n");
  } else {
    console.log("ℹ️  'Coding Practice Problems' lesson already exists — skipping\n");
  }

  // Step 4: Insert problems (skip duplicates)
  let inserted = 0;
  let skipped = 0;

  for (const p of problems) {
    const existing = await prisma.exercise.findFirst({
      where: { lessonId: lesson.id, title: p.title },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const exercise = await prisma.exercise.create({
      data: {
        lessonId: lesson.id,
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

    // Insert test cases
    if (p.testCases && p.testCases.length > 0) {
      for (let i = 0; i < p.testCases.length; i++) {
        await prisma.testCase.create({
          data: {
            exerciseId: exercise.id,
            input: p.testCases[i].input || "",
            expectedOutput: p.testCases[i].expectedOutput || "",
            isHidden: !!p.testCases[i].isHidden,
            order: i + 1,
          },
        });
      }
    }

    inserted++;
    console.log(`  ✅ [${inserted}] ${p.title} (${p.difficulty})`);
  }

  console.log(`\n🎉 Migration Complete!`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped (already exists): ${skipped}`);
  console.log(`   Lesson ID: ${lesson.id}`);
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
