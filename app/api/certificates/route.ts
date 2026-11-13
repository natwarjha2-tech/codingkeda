import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { FinalTestError, issueCertificate, listMyCertificates } from "@/app/services/final-test.service";

/** GET /api/certificates — the current user's certificates. */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    return apiSuccess({ certificates: await listMyCertificates(user!.userId) });
  } catch (err) {
    logger.error("certificates", "list_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Internal server error.");
  }
}

/**
 * POST /api/certificates   body: { attemptId, name }
 * Issues the certificate for a PASSED attempt with the name the student
 * confirmed (once per user per course), then emails the PDF.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const body = await req.json().catch(() => ({}));
    const attemptId = typeof body?.attemptId === "string" ? body.attemptId.trim() : "";
    if (!attemptId) return apiError(400, "attemptId is required.");
    const { certificate, created } = await issueCertificate(user!.userId, attemptId, body?.name);
    return apiSuccess({
      created,
      certificate: {
        code: certificate.code,
        courseId: certificate.courseId,
        courseTitle: certificate.courseTitle,
        studentName: certificate.studentName,
        percent: certificate.percent,
        issuedAt: certificate.issuedAt.toISOString(),
      },
    }, created ? 201 : 200);
  } catch (err) {
    if (err instanceof FinalTestError) return apiError(err.status, err.message);
    logger.error("certificates", "issue_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Internal server error.");
  }
}
