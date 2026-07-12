import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { Prisma } from "@prisma/client";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * POST /api/admin/generate-solutions
 * 
 * Generates best solutions (in all 4 languages) for coding exercises that don't have one.
 * Stores permanently in DB (Exercise.bestSolution field).
 * SAFE: Only updates exercises that have bestSolution = null.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: false, message: "GEMINI_API_KEY not configured." }, { status: 500 });
    }

    // Find coding exercises without best solution
    const exercises = await prisma.exercise.findMany({
      where: { type: "coding", bestSolution: { equals: Prisma.DbNull } },
      select: {
        id: true, title: true, description: true,
        testCases: { select: { input: true, expectedOutput: true }, take: 2 },
        solution: true, // Contains metadata like constraints, TC, SC
      },
      take: 10, // Process 10 at a time to avoid timeout
    });

    if (exercises.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All coding exercises already have solutions!",
        generated: 0,
      });
    }

    let generated = 0;
    for (const ex of exercises) {
      const meta = ex.solution ? (() => { try { return JSON.parse(ex.solution); } catch { return {}; } })() : {};

      const solution = await generateMultiLangSolution({
        title: ex.title,
        description: ex.description,
        constraints: meta.constraints || "",
        inputFormat: meta.inputFormat || "stdin",
        outputFormat: meta.outputFormat || "stdout",
        timeComplexity: meta.timeComplexity || "Optimal",
        spaceComplexity: meta.spaceComplexity || "Optimal",
        testCases: ex.testCases,
      });

      if (solution) {
        await prisma.exercise.update({
          where: { id: ex.id },
          data: { bestSolution: solution as any },
        });
        generated++;
      }

      // Delay between calls to respect rate limits
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Check how many remain
    const remaining = await prisma.exercise.count({
      where: { type: "coding", bestSolution: { equals: Prisma.DbNull } },
    });

    return NextResponse.json({
      success: true,
      message: `Generated ${generated} solution(s). ${remaining} remaining.`,
      generated,
      remaining,
    });
  } catch (err) {
    console.error("Generate solutions error:", err);
    return NextResponse.json(
      { success: false, message: "Failed: " + (err instanceof Error ? err.message : "Unknown") },
      { status: 500 }
    );
  }
}

async function generateMultiLangSolution(problem: any) {
  const prompt = `You are an expert competitive programmer and coding teacher for beginners. Generate the BEST optimized solution for this coding problem in ALL 4 LANGUAGES: C, Java, Python, JavaScript.

PROBLEM: ${problem.title}
DESCRIPTION: ${problem.description}
CONSTRAINTS: ${problem.constraints || "Standard"}
INPUT FORMAT: ${problem.inputFormat || "stdin"}
OUTPUT FORMAT: ${problem.outputFormat || "stdout"}
EXPECTED TC: ${problem.timeComplexity || "Optimal"}
EXPECTED SC: ${problem.spaceComplexity || "Optimal"}
SAMPLE INPUT: ${problem.testCases?.[0]?.input || ""}
SAMPLE OUTPUT: ${problem.testCases?.[0]?.expectedOutput || ""}

IMPORTANT RULES:
- Write SIMPLE, CLEAN code that a junior student can understand
- Use only SHORT, necessary comments (1-2 words max per comment, like "// find max" or "// check prime")
- Do NOT write long explanatory comments or paragraphs in comments
- Keep code concise and readable — avoid over-engineering
- C: use scanf/printf, keep it simple
- Java: use Scanner, class name must be Main, keep it simple
- Python: use input() and print(), keep it Pythonic
- JavaScript: use require('fs').readFileSync('/dev/stdin','utf8') for input, console.log for output

Respond ONLY with valid JSON (no markdown):
{"c":{"code":"complete C code","timeComplexity":"O(...)","spaceComplexity":"O(...)","explanation":"1-2 sentence simple explanation"},"java":{"code":"complete Java code","timeComplexity":"O(...)","spaceComplexity":"O(...)","explanation":"1-2 sentence simple explanation"},"python":{"code":"complete Python code","timeComplexity":"O(...)","spaceComplexity":"O(...)","explanation":"1-2 sentence simple explanation"},"javascript":{"code":"complete JS code","timeComplexity":"O(...)","spaceComplexity":"O(...)","explanation":"1-2 sentence simple explanation"}}`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
