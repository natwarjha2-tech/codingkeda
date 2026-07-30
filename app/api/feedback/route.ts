import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * POST /api/feedback
 * Submit app rating and optional feedback text.
 * Used by: Desktop app "Rate Us" section, Mobile app
 * 
 * Body: { rating: 1-5, feedback?: string, lessonId?, lessonTitle? }
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const body = await req.json();
    const { rating, feedback, lessonId, lessonTitle } = body;

    if (!rating || rating < 1 || rating > 5) {
      return apiError(400, "Rating must be between 1 and 5");
    }

    await prisma.surveyResponse.create({
      data: {
        email: user!.email || user!.userId,
        answers: {
          type: lessonId ? "lesson_rating" : "app_rating",
          rating: Math.round(rating),
          feedback: feedback?.trim() || "",
          lessonId: lessonId || null,
          lessonTitle: lessonTitle || null,
          platform: "desktop",
          userId: user!.userId,
          timestamp: new Date().toISOString(),
        },
        result: `${Math.round(rating)} stars`,
      },
    });

    return apiSuccess({ message: "Thank you for your feedback! 🎉" });
  } catch {
    return apiError(500, "Internal server error");
  }
}
