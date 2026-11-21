import { apiSuccess, apiError } from "@/app/lib/response";
import { getPublicLiveClasses } from "@/app/services/live-public.service";

/**
 * GET /api/public/classes — upcoming and live classes (read-only, no login).
 * Safe fields only; joining still needs login + enrolment via /api/live/classes/[id]/join.
 */
export async function GET() {
  try {
    return apiSuccess({ classes: await getPublicLiveClasses() });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
