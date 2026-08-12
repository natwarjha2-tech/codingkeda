import { prisma } from "@/app/lib/prisma";
import { getSignedFileUrl } from "@/app/lib/s3";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/demo-video
 * Public endpoint — returns presigned URL for the demo video.
 * No auth required (website visitors can watch).
 */
export async function GET() {
  const config = await prisma.siteConfig.findUnique({ where: { key: "demo_video_s3_key" } });

  if (!config || !config.value) {
    return apiError(404, "Demo video not uploaded yet.");
  }

  const url = await getSignedFileUrl(config.value, 3600); // 1 hour expiry
  return apiSuccess({ url });
}
