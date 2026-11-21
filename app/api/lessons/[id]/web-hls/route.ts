import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isActiveEnrollment } from "@/app/lib/access";
import { extractUser } from "@/app/lib/middleware";
import { apiError } from "@/app/lib/response";
import {
  getS3KeyFromUrl,
  getCloudFrontSignedQuery,
  cloudFrontBase,
  isCloudFrontConfigured,
  readS3Text,
} from "@/app/lib/s3";
import { checkStudentDevice } from "@/app/services/student-device.service";
import { checkParentConsent } from "@/app/services/parent-consent.service";

/**
 * GET /api/lessons/[id]/web-hls?file=master.m3u8
 *
 * Browser-friendly HLS delivery through CloudFront (no MP4).
 *
 * Browsers cannot send CloudFront signed cookies from JavaScript, so instead
 * of cookies this route serves the playlists itself, after the same access
 * checks as /play (enrolled OR free lesson, device limit, parent consent):
 *   - every nested playlist (.m3u8) URL is rewritten to come back to this route
 *   - every other URL (segments, init maps, keys) is rewritten to an absolute
 *     CloudFront URL carrying a short-lived signed query for hls/<mediaId>/*
 * Segment bytes are therefore served by the CloudFront edge, not by EC2, and
 * an expired/leaked playlist stops working after the signature expires.
 */

const TTL_SECONDS = 60 * 60 * 4;
// "master.m3u8" or "720p/index.m3u8" – plain path segments only.
const FILE_RE = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*\.m3u8$/;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** Resolve a playlist-relative reference against the playlist's directory. Returns null if it escapes the HLS root. */
function resolveRel(dir: string, ref: string): string | null {
  const parts = (dir ? dir.split("/") : []).filter(Boolean);
  for (const seg of ref.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.join("/");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params;
    if (!lessonId) return apiError(400, "Lesson id is required.");

    const file = req.nextUrl.searchParams.get("file") || "master.m3u8";
    if (!FILE_RE.test(file) || file.split("/").includes("..")) {
      return apiError(400, "Invalid playlist.");
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        videoUrl: true,
        isFree: true,
        module: { select: { courseId: true } },
      },
    });
    if (!lesson) return apiError(404, "Lesson not found.");

    const authUser = extractUser(req);
    const courseId = lesson.module?.courseId;

    if (!lesson.isFree) {
      if (!authUser) return apiError(401, "Please log in to watch this lesson.");
      const enrollment = courseId
        ? await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: authUser.userId, courseId } },
            select: { id: true, expiresAt: true },
          })
        : null;
      if (!isActiveEnrollment(enrollment)) {
        return apiError(403, "Subscribe to watch this lesson.");
      }
    }

    if (authUser) {
      const deviceError = await checkStudentDevice(authUser);
      if (deviceError) return deviceError;
      const consentError = await checkParentConsent(authUser);
      if (consentError) return consentError;
    }

    const s3KeyRaw = lesson.videoUrl ? getS3KeyFromUrl(lesson.videoUrl) : null;
    const media = s3KeyRaw
      ? await prisma.media.findFirst({
          where: { s3Key: s3KeyRaw, isActive: true },
          select: { id: true, hlsStatus: true, hlsMasterUrl: true },
        })
      : null;

    if (!isCloudFrontConfigured() || !media || media.hlsStatus !== "ready" || !media.hlsMasterUrl) {
      return json(404, { success: false, error: "HLS not available for this lesson.", hlsReady: false });
    }

    const prefix = `hls/${media.id}`;
    const signed = getCloudFrontSignedQuery(prefix, TTL_SECONDS);
    if (!signed) return json(404, { success: false, error: "HLS not available.", hlsReady: false });

    const text = await readS3Text(`${prefix}/${file}`);
    if (!text) return json(404, { success: false, error: "Playlist not found." });

    const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
    const cf = cloudFrontBase();
    const selfBase = `/api/lessons/${encodeURIComponent(lessonId)}/web-hls?file=`;

    const rewriteRef = (ref: string): string => {
      const r = ref.trim();
      if (!r || /^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith("//") || r.startsWith("/")) return ref;
      const [pathPart] = r.split("?");
      const rel = resolveRel(dir, pathPart);
      if (!rel) return ref;
      if (rel.toLowerCase().endsWith(".m3u8")) return `${selfBase}${encodeURIComponent(rel).replace(/%2F/g, "/")}`;
      return `${cf}/${prefix}/${rel}?${signed}`;
    };

    const out = text
      .split(/\r?\n/)
      .map((line) => {
        if (!line.trim()) return line;
        if (line.startsWith("#")) {
          return line.replace(/URI="([^"]*)"/g, (_m, u: string) => `URI="${rewriteRef(u)}"`);
        }
        return rewriteRef(line);
      })
      .join("\n");

    return new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("web-hls error:", err);
    return apiError(500, "Internal server error.");
  }
}
