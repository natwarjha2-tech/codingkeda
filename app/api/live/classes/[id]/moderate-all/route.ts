import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { moderateAllParticipants } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/moderate-all
 * Body: { type: "audio" | "video" | "chat", blocked: boolean }
 *
 * Host BULK moderation (Phase 7): enable/disable audio, video, or chat for ALL
 * participants at once. Host/instructor only (enforced in the service). Scales
 * to any class size via a single DB updateMany. The host is excluded.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isLiveClassConfigured()) {
      return apiError(503, "Live class feature is currently unavailable.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const { id } = await params;
    if (!id?.trim()) return apiError(400, "Class id is required.");

    const body = await req.json().catch(() => ({}));
    const { type, blocked } = body as {
      type?: "audio" | "video" | "chat";
      blocked?: boolean;
    };

    if (type !== "audio" && type !== "video" && type !== "chat") {
      return apiError(400, "type must be audio, video, or chat.");
    }

    const result = await moderateAllParticipants({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      type,
      blocked: !!blocked,
    });

    if (!result.ok) {
      return apiError(result.status, result.message || "Failed to moderate participants.");
    }
    return apiSuccess({
      type: result.data!.type,
      blocked: result.data!.blocked,
      count: result.data!.count,
    });
  } catch (err) {
    console.error("Live class moderate-all error:", err);
    return apiError(500, "Internal server error.");
  }
}
