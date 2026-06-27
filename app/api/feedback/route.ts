import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * POST /api/feedback
 * Submit app rating and optional feedback text.
 * Used by: Desktop app "Rate Us" section, Mobile app
 * 
 * Body: { rating: 1-5, feedback?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    const userId = payload.userId;
    const body = await req.json();
    const { rating, feedback, lessonId, lessonTitle } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, message: "Rating must be between 1 and 5" }, { status: 400 });
    }

    // Store in SurveyResponse (reusing existing table — no schema change needed)
    await prisma.surveyResponse.create({
      data: {
        email: payload.email || userId,
        answers: {
          type: lessonId ? "lesson_rating" : "app_rating",
          rating: Math.round(rating),
          feedback: feedback?.trim() || "",
          lessonId: lessonId || null,
          lessonTitle: lessonTitle || null,
          platform: "desktop",
          userId: userId,
          timestamp: new Date().toISOString(),
        },
        result: `${Math.round(rating)} stars`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback! 🎉",
    });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
