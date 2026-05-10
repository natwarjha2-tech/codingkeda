import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl } from "@/app/lib/s3";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { MediaType } from "@prisma/client";

const ALLOWED_TYPES: Record<string, string[]> = {
  video: ["video/mp4", "video/avi", "video/quicktime", "video/x-msvideo"],
  pdf: ["application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp", "image/jpg"],
};

const MEDIA_TYPE_MAP: Record<string, MediaType> = {
  video: MediaType.VIDEO,
  pdf: MediaType.PDF,
  image: MediaType.IMAGE,
};

// Step 1: GET presigned upload URL
export async function POST(req: NextRequest) {
  const { error, user } = requireAdmin(req);
  if (error) return error;

  const { fileName, fileType, fileSize, type, title, description, tags } = await req.json();

  if (!type || !ALLOWED_TYPES[type])
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  if (!ALLOWED_TYPES[type].includes(fileType))
    return NextResponse.json({ error: `Invalid file type for ${type}` }, { status: 400 });

  const timestamp = Date.now();
  const cleanName = fileName.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
  const key = `${type}s/${timestamp}-${cleanName}`;

  const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, fileType);

  // Pre-create the media record so we can return the id
  const media = await prisma.media.create({
    data: {
      title: title?.trim() || fileName,
      description: description?.trim() || null,
      fileName,
      fileSize: fileSize || 0,
      mimeType: fileType,
      type: MEDIA_TYPE_MAP[type],
      s3Key: key,
      s3Url: publicUrl,
      tags: tags ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      uploadedBy: user!.userId,
    },
  });

  return NextResponse.json({ uploadUrl, publicUrl, key, mediaId: media.id });
}
