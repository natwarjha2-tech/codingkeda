import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { deleteFromS3 } from "@/app/lib/s3";

/**
 * POST /api/admin/upload/cleanup
 * Clean up orphaned inactive Media records (uploaded but never saved).
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const orphaned = await prisma.media.findMany({
      where: { isActive: false, createdAt: { lt: oneHourAgo } },
      select: { id: true, s3Key: true, fileName: true, createdAt: true },
    });

    if (orphaned.length === 0) return apiSuccess({ message: "No orphaned uploads found.", cleaned: 0 });

    let s3Deleted = 0;
    for (const media of orphaned) { if (await deleteFromS3(media.s3Key)) s3Deleted++; }

    await prisma.media.deleteMany({ where: { id: { in: orphaned.map((m) => m.id) } } });

    return apiSuccess({
      message: `Cleaned up ${orphaned.length} orphaned uploads (${s3Deleted} S3 files deleted).`,
      cleaned: orphaned.length,
      details: orphaned.map((m) => ({ id: m.id, fileName: m.fileName, createdAt: m.createdAt })),
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
