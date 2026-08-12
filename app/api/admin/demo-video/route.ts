import { NextRequest } from "next/server";
import { getPresignedUploadUrl, getSignedFileUrl } from "@/app/lib/s3";
import { prisma } from "@/app/lib/prisma";
import { requireSuperAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"];
const MAX_SIZE = 500 * 1024 * 1024; // 500MB

/**
 * POST /api/admin/demo-video
 * Super admin uploads a demo video (presigned URL flow)
 * Body: { fileName, fileType, fileSize }
 * Returns: { uploadUrl, s3Key }
 */
export async function POST(req: NextRequest) {
  const { error, user } = requireSuperAdmin(req);
  if (error) return error;

  const { fileName, fileType, fileSize } = await req.json();

  if (!fileName || !fileType) return apiError(400, "fileName and fileType are required.");
  if (!ALLOWED_TYPES.includes(fileType)) return apiError(400, "Only MP4, MOV, AVI video files allowed.");
  if (fileSize && fileSize > MAX_SIZE) return apiError(400, "File too large. Max 500MB.");

  const timestamp = Date.now();
  const cleanName = fileName.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
  const key = `site/demo-video-${timestamp}-${cleanName}`;

  const { uploadUrl } = await getPresignedUploadUrl(key, fileType, 600);

  // Save or update the demo video S3 key in SiteConfig
  await prisma.siteConfig.upsert({
    where: { key: "demo_video_s3_key" },
    update: { value: key },
    create: { key: "demo_video_s3_key", value: key },
  });

  return apiSuccess({ uploadUrl, s3Key: key });
}

/**
 * GET /api/admin/demo-video
 * Super admin fetches current demo video info
 */
export async function GET(req: NextRequest) {
  const { error } = requireSuperAdmin(req);
  if (error) return error;

  const config = await prisma.siteConfig.findUnique({ where: { key: "demo_video_s3_key" } });

  if (!config || !config.value) {
    return apiSuccess({ hasVideo: false, url: null });
  }

  const url = await getSignedFileUrl(config.value, 3600);
  return apiSuccess({ hasVideo: true, url, s3Key: config.value });
}
