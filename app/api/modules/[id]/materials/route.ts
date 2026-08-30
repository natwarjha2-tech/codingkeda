import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";

/**
 * GET /api/modules/:id/materials
 * Get all study materials for a module (student-facing, with signed URLs)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: moduleId } = await params;
    const signed = req.nextUrl.searchParams.get("signed") === "true";

    const materials = await prisma.moduleMaterial.findMany({
      where: { moduleId },
      orderBy: { order: "asc" },
      select: { id: true, title: true, fileUrl: true, fileType: true, fileSize: true, order: true },
    });

    // Generate signed URLs if requested
    if (signed) {
      for (const mat of materials) {
        if (getS3KeyFromUrl(mat.fileUrl)) {
          try {
            mat.fileUrl = await getSignedFileUrlFromUrl(mat.fileUrl, 3600);
          } catch {}
        }
      }
    }

    return NextResponse.json({ success: true, materials });
  } catch (err) {
    console.error("Get module materials error:", err);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
