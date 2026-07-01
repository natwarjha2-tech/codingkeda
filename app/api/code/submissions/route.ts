import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/code/submissions?exerciseId=xxx
 * 
 * Get submission history for a specific exercise (current user only).
 * Returns last 10 submissions ordered by most recent first.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const exerciseId = req.nextUrl.searchParams.get("exerciseId");

    if (!exerciseId) {
      return NextResponse.json(
        { success: false, message: "exerciseId is required." },
        { status: 400 }
      );
    }

    const submissions = await prisma.exerciseSubmission.findMany({
      where: {
        userId: payload.userId,
        exerciseId: exerciseId,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        language: true,
        passed: true,
        status: true,
        executionTime: true,
        memoryUsed: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, submissions });
  } catch (err: any) {
    if (err?.message?.includes("jwt") || err?.message?.includes("token")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
