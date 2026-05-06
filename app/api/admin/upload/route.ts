import { NextRequest, NextResponse } from "next/server";
import { uploadToS3 } from "@/app/lib/s3";
import { prisma } from "@/app/lib/prisma";
import { MediaType } from "@prisma/client";

export const config = { api: { bodyParser: false } };

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
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const title = ((formData.get("title") as string)?.trim()) || file?.name || "Untitled";
    const description = (formData.get("description") as string)?.trim() || null;
    const tagsRaw = (formData.get("tags") as string)?.trim() || "";

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
    const key = `${type}s/${timestamp}-${cleanName}`;

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
      },
    });

    return NextResponse.json({
      success: true,
      media: {
        id: media.id,
        title: media.title,
        url: media.s3Url,
        key: media.s3Key,
        type: media.type,
        tags: media.tags,
        createdAt: media.createdAt,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
