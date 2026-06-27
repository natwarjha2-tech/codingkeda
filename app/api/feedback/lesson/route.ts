import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/feedback/lesson?lessonId=xxx
 * Returns all ratings and reviews for a specific lesson.
 * No auth required — public data (like Udemy reviews).
 */
export async function GET(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) {
      return NextResponse.json({ success: false, message: "lessonId required" }, { status: 400 });
    }

    // Fetch all reviews for this lesson from SurveyResponse
    const reviews = await prisma.surveyResponse.findMany({
      where: {
        answers: {
          path: ["lessonId"],
          equals: lessonId,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Parse and format
    const formattedReviews: Array<{
      rating: number;
      feedback: string;
      createdAt: Date;
      studentName: string;
    }> = [];

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    for (const review of reviews) {
      const data = review.answers as any;
      if (data && data.rating) {
        const rating = Math.min(5, Math.max(1, Math.round(data.rating)));
        ratingCounts[rating as keyof typeof ratingCounts]++;
        totalRating += rating;

        formattedReviews.push({
          rating,
          feedback: data.feedback || "",
          createdAt: review.createdAt,
          studentName: review.email ? review.email.split("@")[0] : "Student",
        });
      }
    }

    const totalReviews = formattedReviews.length;
    const avgRating = totalReviews > 0 ? Math.round((totalRating / totalReviews) * 10) / 10 : 0;

    return NextResponse.json({
      success: true,
      lessonId,
      avgRating,
      totalReviews,
      ratingCounts,
      reviews: formattedReviews,
    });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
