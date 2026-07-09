import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/coding-problems/best-solution?problemId=xxx
 * Returns best solution for a problem (from DB — persistent).
 * 
 * POST /api/coding-problems/best-solution
 * Generates and stores best solution for a specific problem.
 * Called when: new coding exercise is added.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

interface BestSolution {
  code: string;
  language: string;
  timeComplexity: string;
  spaceComplexity: string;
  explanation: string;
  generatedAt: string;
}

/**
 * GET — Fetch stored solution from DB (instant)
 */
export async function GET(req: NextRequest) {
  try {
    const problemId = req.nextUrl.searchParams.get("problemId");

    if (!problemId) {
      return NextResponse.json(
        { success: false, message: "problemId is required." },
        { status: 400 }
      );
    }

    // Check DB for stored solution
    const exercise = await prisma.exercise.findUnique({
      where: { id: problemId },
      select: { bestSolution: true, title: true, description: true },
    });

    if (exercise && exercise.bestSolution) {
      return NextResponse.json({ success: true, solution: exercise.bestSolution });
    }

    // Also check in-memory for legacy 33 problems (coding-problems API problems)
    const inMemory = storedSolutions.get(problemId);
    if (inMemory) {
      return NextResponse.json({ success: true, solution: inMemory });
    }

    // Not yet generated — trigger generation in background
    generateAndStore(problemId).catch(() => {});
    return NextResponse.json({
      success: false,
      message: "Solution is being generated. Please try again in a moment.",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST — Generate and store solution
 * Body: { problemId } or { generateAll: true }
 */
export async function POST(req: NextRequest) {
  try {
    const { problemId, generateAll } = await req.json();

    if (generateAll) {
      const count = await bulkGenerateAll();
      return NextResponse.json({
        success: true,
        message: `Generated solutions for ${count} problems.`,
      });
    }

    if (problemId) {
      const result = await generateAndStore(problemId);
      return NextResponse.json({
        success: !!result,
        message: result ? "Solution generated and stored." : "Failed to generate.",
      });
    }

    return NextResponse.json(
      { success: false, message: "Provide problemId or generateAll:true" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════
// SOLUTION GENERATION ENGINE
// ═══════════════════════════════════════════════════════

// In-memory cache for legacy coding-problems (33 problems from API)
const storedSolutions = new Map<string, BestSolution>();

/**
 * Generate and store best solution for a single problem
 * Stores in DB (Exercise.bestSolution) for persistence
 */
async function generateAndStore(problemId: string): Promise<BestSolution | null> {
  // Check DB first
  try {
    const exercise = await prisma.exercise.findUnique({
      where: { id: problemId },
      select: { bestSolution: true, title: true, description: true, testCases: { select: { input: true, expectedOutput: true }, take: 2 } },
    });

    if (exercise && exercise.bestSolution) {
      return exercise.bestSolution as unknown as BestSolution;
    }

    // If exercise exists in DB, generate from its data
    if (exercise) {
      const solution = await callGeminiForSolution({
        title: exercise.title,
        description: exercise.description,
        testCases: exercise.testCases,
      });
      if (solution) {
        // Save to DB permanently
        await prisma.exercise.update({
          where: { id: problemId },
          data: { bestSolution: solution as any },
        });
        return solution;
      }
      return null;
    }
  } catch {
    // Exercise not found in DB — try legacy problems
  }

  // Check in-memory (legacy 33 problems)
  if (storedSolutions.has(problemId)) return storedSolutions.get(problemId)!;

  // Fetch from coding-problems API (legacy)
  const problem = await fetchProblem(problemId);
  if (!problem) return null;

  const solution = await callGeminiForSolution(problem);
  if (!solution) return null;

  // Store in memory for legacy problems
  storedSolutions.set(problemId, solution);
  return solution;
}

/**
 * Bulk generate for ALL problems
 */
async function bulkGenerateAll(): Promise<number> {
  // Generate for DB exercises (coding type without bestSolution)
  const exercises = await prisma.exercise.findMany({
    where: { type: "coding", bestSolution: { equals: Prisma.DbNull } },
    select: { id: true, title: true, description: true, testCases: { select: { input: true, expectedOutput: true }, take: 2 } },
    take: 50,
  });

  let generated = 0;
  for (const ex of exercises) {
    const solution = await callGeminiForSolution(ex);
    if (solution) {
      await prisma.exercise.update({
        where: { id: ex.id },
        data: { bestSolution: solution as any },
      });
      generated++;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Also generate for legacy coding-problems
  const problems = await fetchAllProblems();
  if (problems) {
    for (const problem of problems) {
      if (storedSolutions.has(problem.id)) { generated++; continue; }
      const solution = await callGeminiForSolution(problem);
      if (solution) {
        storedSolutions.set(problem.id, solution);
        generated++;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return generated;
}

/**
 * Fetch single problem by ID (legacy coding-problems)
 */
async function fetchProblem(problemId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/coding-problems`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    return data.problems.find((p: any) => p.id === problemId) || null;
  } catch { return null; }
}

/**
 * Fetch all legacy problems
 */
async function fetchAllProblems() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/coding-problems`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.problems : null;
  } catch { return null; }
}

/**
 * Call Gemini AI to generate best solution
 */
async function callGeminiForSolution(problem: any): Promise<BestSolution | null> {
  if (!GEMINI_API_KEY) return null;

  const prompt = `You are an expert competitive programmer. Generate the BEST optimized solution for this coding problem.

PROBLEM: ${problem.title}
DESCRIPTION: ${problem.description}
CONSTRAINTS: ${problem.constraints || "Standard"}
INPUT FORMAT: ${problem.inputFormat || "stdin"}
OUTPUT FORMAT: ${problem.outputFormat || "stdout"}
EXPECTED TC: ${problem.timeComplexity || "Optimal"}
EXPECTED SC: ${problem.spaceComplexity || "Optimal"}
SAMPLE INPUT: ${problem.testCases?.[0]?.input || ""}
SAMPLE OUTPUT: ${problem.testCases?.[0]?.expectedOutput || ""}

Write in C language. Code must read from stdin (scanf) and write to stdout (printf).
Be the MOST optimized approach possible.

Respond ONLY with valid JSON (no markdown):
{"code":"complete C code with \\n for newlines","language":"c","timeComplexity":"O(...)","spaceComplexity":"O(...)","explanation":"2-3 sentence explanation of approach"}`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      code: parsed.code || "",
      language: parsed.language || "c",
      timeComplexity: parsed.timeComplexity || "O(?)",
      spaceComplexity: parsed.spaceComplexity || "O(?)",
      explanation: parsed.explanation || "Optimal solution.",
      generatedAt: new Date().toISOString(),
    };
  } catch { return null; }
}
