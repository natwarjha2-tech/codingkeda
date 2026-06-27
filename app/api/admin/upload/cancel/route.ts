import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { deleteFromS3 } from "@/app/lib/s3";

/**
 * POST /api/admin/upload/cancel
 * Cancel a pending upload — deletes Media record from DB and file from S3.
 * Only works for inactive (pending) media records.
 * Called when admin cancels the modal without clicking Save.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { mediaId } = await req.json();

    if (!mediaId) {
      return NextResponse.json(
        { success: false, message: "mediaId is required." },
        { status: 400 }
      );
    }

    // Only delete if media is still inactive (not yet saved/confirmed)
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) {
      return NextResponse.json({ success: true, message: "Media not found, nothing to cancel." });
    }

    if (media.isActive) {
      return NextResponse.json(
        { success: false, message: "Cannot cancel an already-saved upload." },
        { status: 400 }
      );
    }

    // Delete from S3
    await deleteFromS3(media.s3Key);

    // Delete from DB
    await prisma.media.delete({ where: { id: mediaId } });

    return NextResponse.json({
      success: true,
      message: "Pending upload cancelled and cleaned up.",
    });
  } catch (err) {
    console.error("Cancel upload error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
