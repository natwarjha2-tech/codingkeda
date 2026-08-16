import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/lessons/:id/reaction
 * Get like/dislike counts + view count + current user's reaction
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params;

    const [likes, dislikes, lesson] = await Promise.all([
      prisma.lessonReaction.count({ where: { lessonId, type: "like" } }),
      prisma.lessonReaction.count({ where: { lessonId, type: "dislike" } }),
      prisma.lesson.findUnique({ where: { id: lessonId }, select: { viewCount: true } }),
    ]);

    let userReaction: string | null = null;
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      try {
        const payload = verifyToken(token);
        const reaction = await prisma.lessonReaction.findUnique({
          where: { userId_lessonId: { userId: payload.userId, lessonId } },
        });
        if (reaction) userReaction = reaction.type;
      } catch {}
    }

    return NextResponse.json({
      success: true,
      likes,
      dislikes,
      views: lesson?.viewCount || 0,
      userReaction,
    });
  } catch (err) {
    console.error("Get reaction error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lessons/:id/reaction
 * Like or dislike a lesson. Toggle off if same type sent again.
 * Body: { type: "like" | "dislike" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: lessonId } = await params;
    const { type } = await req.json();

    if (!type || !["like", "dislike"].includes(type)) {
      return NextResponse.json(
        { success: false, message: "type must be 'like' or 'dislike'." },
        { status: 400 }
      );
    }

    const existing = await prisma.lessonReaction.findUnique({
      where: { userId_lessonId: { userId: payload.userId, lessonId } },
    });

    if (existing) {
      if (existing.type === type) {
        // Same type — remove reaction (toggle off)
        await prisma.lessonReaction.deleteMany({ where: { id: existing.id } });
      } else {
        // Different type — switch
        await prisma.lessonReaction.updateMany({ where: { id: existing.id }, data: { type } });
      }
    } else {
      await prisma.lessonReaction.create({
        data: { userId: payload.userId, lessonId, type },
      });
    }

    // Return updated counts
    const [likes, dislikes] = await Promise.all([
      prisma.lessonReaction.count({ where: { lessonId, type: "like" } }),
      prisma.lessonReaction.count({ where: { lessonId, type: "dislike" } }),
    ]);

    const newReaction = await prisma.lessonReaction.findUnique({
      where: { userId_lessonId: { userId: payload.userId, lessonId } },
    });

    return NextResponse.json({
      success: true,
      likes,
      dislikes,
      userReaction: newReaction?.type || null,
    });
  } catch (err) {
    console.error("Post reaction error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
