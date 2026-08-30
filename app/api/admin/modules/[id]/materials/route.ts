import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { deleteFromS3, getS3KeyFromUrl } from "@/app/lib/s3";

/**
 * GET /api/admin/modules/:id/materials
 * Get all materials for a module
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;
    const { id: moduleId } = await params;

    const materials = await prisma.moduleMaterial.findMany({
      where: { moduleId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ success: true, materials });
  } catch (err) {
    console.error("Get materials error:", err);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

/**
 * POST /api/admin/modules/:id/materials
 * Add a material to a module
 * Body: { title, fileUrl, fileType?, fileSize? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;
    const { id: moduleId } = await params;
    const { title, fileUrl, fileType, fileSize } = await req.json();

    if (!title || !fileUrl) {
      return NextResponse.json({ success: false, message: "title and fileUrl are required." }, { status: 400 });
    }

    const lastMaterial = await prisma.moduleMaterial.findFirst({
      where: { moduleId },
      orderBy: { order: "desc" },
    });

    const material = await prisma.moduleMaterial.create({
      data: {
        moduleId,
        title: title.trim(),
        fileUrl,
        fileType: fileType || "pdf",
        fileSize: fileSize || 0,
        order: (lastMaterial?.order ?? 0) + 1,
      },
    });

    return NextResponse.json({ success: true, material }, { status: 201 });
  } catch (err) {
    console.error("Add material error:", err);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/modules/:id/materials
 * Delete a material by materialId in body
 * Body: { materialId }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;
    const { materialId } = await req.json();

    if (!materialId) {
      return NextResponse.json({ success: false, message: "materialId is required." }, { status: 400 });
    }

    const material = await prisma.moduleMaterial.findUnique({ where: { id: materialId } });
    if (!material) {
      return NextResponse.json({ success: false, message: "Material not found." }, { status: 404 });
    }

    // Delete from S3
    const s3Key = getS3KeyFromUrl(material.fileUrl);
    if (s3Key) await deleteFromS3(s3Key);

    // Delete from DB
    await prisma.moduleMaterial.delete({ where: { id: materialId } });

    return NextResponse.json({ success: true, message: "Material deleted." });
  } catch (err) {
    console.error("Delete material error:", err);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
