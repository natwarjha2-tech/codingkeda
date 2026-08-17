import { NextRequest } from "next/server";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * POST /api/media/signed-url
 * Generate a temporary signed URL for a private S3 file.
 * Requires authentication — prevents unauthenticated access to private content.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAuth(req);
    if (error) return error;

    const { url } = await req.json();

    if (!url?.trim()) {
      return apiError(400, "URL is required.");
    }

    const s3Key = getS3KeyFromUrl(url);
    if (!s3Key) {
      return apiError(400, "Invalid S3 URL.");
    }

    const signedUrl = await getSignedFileUrlFromUrl(url, 900); // 15 minutes

    return apiSuccess({ signedUrl });
  } catch (err) {
    console.error("Signed URL error:", err);
    return apiError(500, "Failed to generate signed URL.");
  }
}
