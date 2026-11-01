import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { extractUser } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import {
  getS3KeyFromUrl,
  getCloudFrontSignedCookies,
  getHlsMasterUrl,
  isCloudFrontConfigured,
} from "@/app/lib/s3";

/**
 * GET /api/lessons/[id]/hls-auth
 *
 * Authorizes HLS playback for ONE lesson and hands the client everything it
 * needs to stream the adaptive HLS rendition from the CloudFront edge:
 *   { hlsReady, masterUrl, cookies, expiresIn }
 *
 * - Access check mirrors /play: user must be enrolled in the lesson's course OR
 *   the lesson is free. Locked → hlsReady:false, no cookies.
 * - When the media's HLS output is ready, we return the (stable, cacheable)
 *   master playlist URL + CloudFront SIGNED COOKIES scoped to that media's
 *   hls/<mediaId>/* prefix. The player sends the cookies on every segment
 *   request; CloudFront caches the segments at the edge (shared across users).
 * - If HLS isn't ready (or CloudFront isn't configured), hlsReady:false — the
 *   client falls back to the signed MP4 qualities from /play.
 *
 * The HLS output lives under a dedicated `hls/<mediaId>/` prefix (written by the
 * video processor), independent of the MP4 `qualities/` prefix.
 */

const COOKIE_TTL_SECONDS = 60 * 60 * 4; // 4h — long enough for a full lesson view

function hlsPrefixForMedia(mediaId: string): string {
  return `hls/${mediaId}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params;
    if (!lessonId) return apiError(400, "Lesson id is required.");

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

    const courseId = lesson.module?.courseId;
    const authUser = extractUser(req);
    const s3KeyRaw = lesson.videoUrl ? getS3KeyFromUrl(lesson.videoUrl) : null;

    const [enrollment, media] = await Promise.all([
      authUser && courseId
        ? prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: authUser.userId, courseId } },
            select: { id: true },
          })
        : Promise.resolve(null),
      s3KeyRaw
        ? prisma.media.findFirst({
            where: { s3Key: s3KeyRaw, isActive: true },
            select: { id: true, hlsStatus: true, hlsMasterUrl: true },
          })
        : Promise.resolve(null),
    ]);

    const canAccess = !!enrollment || lesson.isFree;
    if (!canAccess) {
      return apiSuccess({ hlsReady: false, locked: true, masterUrl: null, cookies: null, expiresIn: 0 });
    }

    // HLS is only usable when: CloudFront is configured, the media has a real
    // HLS master produced, and we have a mediaId to scope the cookie policy to.
    const hlsReady =
      isCloudFrontConfigured() &&
      !!media &&
      media.hlsStatus === "ready" &&
      !!media.hlsMasterUrl;

    if (!hlsReady || !media) {
      // Client falls back to signed MP4 qualities from /play.
      return apiSuccess({ hlsReady: false, locked: false, masterUrl: null, cookies: null, expiresIn: 0 });
    }

    const prefix = hlsPrefixForMedia(media.id);
    const cookies = getCloudFrontSignedCookies(prefix, COOKIE_TTL_SECONDS);
    if (!cookies) {
      return apiSuccess({ hlsReady: false, locked: false, masterUrl: null, cookies: null, expiresIn: 0 });
    }

    return apiSuccess({
      hlsReady: true,
      locked: false,
      masterUrl: getHlsMasterUrl(prefix),
      cookies,
      expiresIn: COOKIE_TTL_SECONDS,
    });
  } catch (err) {
    console.error("HLS auth error:", err);
    return apiError(500, "Internal server error.");
  }
}
