import { NextRequest } from "next/server";
import { getPresignedUploadUrl } from "@/app/lib/s3";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { MediaType } from "@prisma/client";

// Safe, readable S3 path segment: lowercase, spaces→dashes, unsafe chars stripped.
function slugify(name: string | null | undefined): string {
  const s = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "untitled";
}

const ALLOWED_TYPES: Record<string, string[]> = {
  video: ["video/mp4", "video/avi", "video/quicktime", "video/x-msvideo"],
  pdf: ["application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp", "image/jpg"],
  ppt: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
};

const MEDIA_TYPE_MAP: Record<string, MediaType> = {
  video: MediaType.VIDEO,
  pdf: MediaType.PDF,
  image: MediaType.IMAGE,
  ppt: MediaType.PDF, // PPT stored as document type alongside PDFs
};

// Step 1: GET presigned upload URL
export async function POST(req: NextRequest) {
  const { error, user } = requireAdmin(req);
  if (error) return error;

  const { fileName, fileType, fileSize, type, title, description, tags, courseId, categoryId, moduleId, lessonTitle } = await req.json();

  if (!type || !ALLOWED_TYPES[type])
    return apiError(400, "Invalid type");

  if (!ALLOWED_TYPES[type].includes(fileType))
    return apiError(400, `Invalid file type for ${type}`);

  const ext = (String(fileName).split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");

  // Create the media record FIRST so we have a stable mediaId to embed in the
  // S3 key (unique + rename-proof). Key is finalized right after.
  const media = await prisma.media.create({
    data: {
      title: title?.trim() || fileName,
      description: description?.trim() || null,
      fileName,
      fileSize: BigInt(Math.max(0, Math.round(Number(fileSize) || 0))),
      mimeType: fileType,
      type: MEDIA_TYPE_MAP[type],
      s3Key: "", // set below once we build the key
      s3Url: "",
      tags: tags ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      uploadedBy: user!.userId,
      isActive: false, // Will be activated when admin clicks Save
      ...(MEDIA_TYPE_MAP[type] === "VIDEO" && { hlsStatus: "pending" }),
    },
  });

  // Build a readable, nested key when we know the course/module (else a clean
  // mediaId-based folder). Names are for readability; mediaId keeps it unique
  // and rename-proof. Pattern: <type>s/<course>/<module>/<lesson>-<mediaId>/original.<ext>
  let key: string;
  if (courseId && moduleId) {
    let courseSlug = "course", moduleSlug = "module";
    try {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
      const mod = await prisma.module.findUnique({ where: { id: moduleId }, select: { title: true } });
      courseSlug = slugify(course?.title);
      moduleSlug = slugify(mod?.title);
    } catch { /* fall back to defaults */ }
    const leaf = lessonTitle && String(lessonTitle).trim()
      ? `${slugify(lessonTitle)}-${media.id}`
      : media.id;
    key = `${type}s/${courseSlug}/${moduleSlug}/${leaf}/original.${ext}`;
  } else {
    key = `${type}s/${media.id}/original.${ext}`;
  }

  const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, fileType);

  // Persist the final key/url on the media record.
  await prisma.media.update({
    where: { id: media.id },
    data: { s3Key: key, s3Url: publicUrl },
  });

  return apiSuccess({ uploadUrl, publicUrl, key, mediaId: media.id });
}
