import { NextRequest, NextResponse } from "next/server";
import { uploadToS3, getSignedFileUrl } from "@/app/lib/s3";
import { prisma } from "@/app/lib/prisma";
import { MediaType } from "@prisma/client";
import { requireAdmin } from "@/app/lib/middleware";
import { processVideoHls } from "@/app/lib/hls-processor";

const ALLOWED_TYPES: Record<string, string[]> = {
  video: ["video/mp4", "video/avi", "video/quicktime", "video/x-msvideo"],
  pdf: ["application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp", "image/jpg"],
};

const MAX_SIZE: Record<string, number> = {
  video: 500 * 1024 * 1024,
  pdf: 50 * 1024 * 1024,
  image: 5 * 1024 * 1024,
};

const MEDIA_TYPE_MAP: Record<string, MediaType> = {
  video: MediaType.VIDEO,
  pdf: MediaType.PDF,
  image: MediaType.IMAGE,
};

export async function POST(req: NextRequest) {
  try {
    // Admin authentication check
    const { error, user } = requireAdmin(req);
    if (error) return error;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const title = ((formData.get("title") as string)?.trim()) || file?.name || "Untitled";
    const description = (formData.get("description") as string)?.trim() || null;
    const tagsRaw = (formData.get("tags") as string)?.trim() || "";
    const courseId = formData.get("courseId") as string;
    const categoryId = formData.get("categoryId") as string;
    const moduleId = formData.get("moduleId") as string;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!type || !ALLOWED_TYPES[type]) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

    if (!ALLOWED_TYPES[type].includes(file.type)) {
      return NextResponse.json({ error: `Invalid file type for ${type}` }, { status: 400 });
    }

    if (file.size > MAX_SIZE[type]) {
      return NextResponse.json({ error: `File too large for ${type}` }, { status: 400 });
    }

    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

    const ext = file.name.split(".").pop();
    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
    
    // Generate S3 key with metadata (course-cat-module)
    let key = `${type}s/${timestamp}-${cleanName}`;
    if (courseId && categoryId && moduleId) {
      key = `${type}s/course-${courseId}-cat-${categoryId}-module-${moduleId}-${timestamp}-${cleanName}`;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToS3(buffer, key, file.type);

    const media = await prisma.media.create({
      data: {
        title,
        description,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        type: MEDIA_TYPE_MAP[type],
        s3Key: key,
        s3Url: url,
        tags,
        uploadedBy: user!.userId,
        isActive: false, // Will be activated when admin clicks Save
        ...(MEDIA_TYPE_MAP[type] === "VIDEO" && { hlsStatus: "pending" }),
      },
    });

    // Generate presigned URL for immediate use
    const presignedUrl = await getSignedFileUrl(key, 3600);

    // Auto-trigger HLS processing for video uploads (non-blocking, runs in background)
    if (MEDIA_TYPE_MAP[type] === "VIDEO") {
      processVideoHls(media.id, key, url).catch((err) => {
        console.error(`[HLS] Background processing failed for ${media.id}:`, err);
      });
    }

    return NextResponse.json({
      success: true,
      media: {
        id: media.id,
        title: media.title,
        url: presignedUrl,
        key: media.s3Key,
        type: media.type,
        tags: media.tags,
        createdAt: media.createdAt,
        hlsStatus: MEDIA_TYPE_MAP[type] === "VIDEO" ? "pending" : "none",
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
