import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { deleteFromS3 } from "@/app/lib/s3";

/**
 * POST /api/admin/upload/cleanup
 * Clean up orphaned inactive Media records (uploaded but never saved).
 * Deletes Media records older than 1 hour that are still inactive.
 * Can be called manually from admin dashboard or via a cron job.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    // Find all inactive media older than 1 hour (orphaned uploads)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const orphaned = await prisma.media.findMany({
      where: {
        isActive: false,
        createdAt: { lt: oneHourAgo },
      },
      select: { id: true, s3Key: true, fileName: true, createdAt: true },
    });

    if (orphaned.length === 0) {
      return NextResponse.json({ success: true, message: "No orphaned uploads found.", cleaned: 0 });
    }

    // Delete from S3
    let s3Deleted = 0;
    for (const media of orphaned) {
      const deleted = await deleteFromS3(media.s3Key);
      if (deleted) s3Deleted++;
    }

    // Delete from DB
    await prisma.media.deleteMany({
      where: { id: { in: orphaned.map((m) => m.id) } },
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${orphaned.length} orphaned uploads (${s3Deleted} S3 files deleted).`,
      cleaned: orphaned.length,
      details: orphaned.map((m) => ({ id: m.id, fileName: m.fileName, createdAt: m.createdAt })),
    });
  } catch (err) {
    console.error("Cleanup error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
