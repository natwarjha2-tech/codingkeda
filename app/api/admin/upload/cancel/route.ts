import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { deleteFromS3 } from "@/app/lib/s3";

/**
 * POST /api/admin/upload/cancel
 * Cancel a pending upload — deletes Media record + S3 file.
 * Only works for inactive (pending) media records.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { mediaId } = await req.json();
    if (!mediaId) return apiError(400, "mediaId is required.");

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return apiSuccess({ message: "Media not found, nothing to cancel." });
    if (media.isActive) return apiError(400, "Cannot cancel an already-saved upload.");

    await deleteFromS3(media.s3Key);
    await prisma.media.delete({ where: { id: mediaId } });

    return apiSuccess({ message: "Pending upload cancelled and cleaned up." });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
