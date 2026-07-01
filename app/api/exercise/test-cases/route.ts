import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/exercise/test-cases?exerciseId=xxx
 * Get visible (non-hidden) test cases for an exercise.
 * Hidden test cases are only used during server-side submission evaluation.
 */
export async function GET(req: NextRequest) {
  try {
    const exerciseId = req.nextUrl.searchParams.get("exerciseId");

    if (!exerciseId) {
      return NextResponse.json(
        { success: false, message: "exerciseId is required." },
        { status: 400 }
      );
    }

    // Only return non-hidden test cases to the client
    const testCases = await prisma.testCase.findMany({
      where: { exerciseId, isHidden: false },
      orderBy: { order: "asc" },
      select: {
        id: true,
        input: true,
        expectedOutput: true,
        order: true,
      },
    });

    return NextResponse.json({ success: true, testCases });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
