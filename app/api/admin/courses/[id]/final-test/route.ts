import { NextRequest } from "next/server";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { asIdArray, buildFinalTestForCourse } from "@/app/lib/final-test";

/** GET — current final test summary for a course (admin). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = requireAdmin(req);
  if (error) return error;
  const { id } = await params;
  const test = await prisma.finalTest.findUnique({ where: { courseId: id } });
  if (!test) return apiSuccess({ exists: false });
  return apiSuccess({
    exists: true,
    questions: asIdArray(test.quizIds).length,
    passPercent: test.passPercent,
    timeLimitMin: test.timeLimitMin,
    updatedAt: test.updatedAt.toISOString(),
  });
}

/**
 * POST — (re)generate the course's final test from its lesson quizzes
 * (same as `npm run final-test:generate`). Existing attempts and certificates
 * are not affected; new attempts use the new question set.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = requireAdmin(req);
    if (error) return error;
    const { id } = await params;
    const result = await buildFinalTestForCourse(prisma, id);
    logger.success("final-test", "generated", { by: user!.userId, courseId: id, picked: result.picked });
    return apiSuccess(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    logger.error("final-test", "generate_error", { error: msg });
    return apiError(/not found|no lesson quizzes/i.test(msg) ? 400 : 500, msg);
  }
}
