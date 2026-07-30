import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { uploadToS3, getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";

/**
 * POST /api/student/avatar
 * Upload avatar image to S3 and save URL in DB
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;
    if (!file) return apiError(400, "No file provided.");
    if (!file.type.startsWith("image/")) return apiError(400, "File must be an image.");
    if (file.size > 2 * 1024 * 1024) return apiError(400, "Image must be less than 2MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `avatars/${user!.userId}-${Date.now()}.${file.type.split("/")[1]}`;
    const s3Url = await uploadToS3(buffer, key, file.type);

    await prisma.user.update({ where: { id: user!.userId }, data: { avatarUrl: s3Url } });
    const signedUrl = await getSignedFileUrlFromUrl(s3Url, 86400);

    return apiSuccess({ avatarUrl: signedUrl });
  } catch {
    return apiError(500, "Failed to upload avatar. Please try again.");
  }
}

/**
 * GET /api/student/avatar
 * Get current user's avatar as a presigned URL
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const dbUser = await prisma.user.findUnique({ where: { id: user!.userId }, select: { avatarUrl: true } });
    if (!dbUser?.avatarUrl) return apiSuccess({ avatarUrl: null });

    const s3Key = getS3KeyFromUrl(dbUser.avatarUrl);
    if (s3Key) {
      const signedUrl = await getSignedFileUrlFromUrl(dbUser.avatarUrl, 86400);
      return apiSuccess({ avatarUrl: signedUrl });
    }

    return apiSuccess({ avatarUrl: dbUser.avatarUrl });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
