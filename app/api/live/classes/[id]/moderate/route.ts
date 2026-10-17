import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { moderateParticipant } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/moderate
 * Body: { targetUserId, type: "audio" | "video" | "chat", blocked: boolean }
 *
 * Host PER-PARTICIPANT moderation (Phase 4): enable/disable one participant's
 * audio, video, or chat. Host/instructor only (enforced in the service).
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
    const { targetUserId, type, blocked } = body as {
      targetUserId?: string;
      type?: "audio" | "video" | "chat";
      blocked?: boolean;
    };
    if (!targetUserId?.trim()) return apiError(400, "targetUserId is required.");
    if (type !== "audio" && type !== "video" && type !== "chat") {
      return apiError(400, "type must be audio, video, or chat.");
    }

    const result = await moderateParticipant({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      targetUserId: targetUserId.trim(),
      type,
      blocked: !!blocked,
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to moderate.");
    return apiSuccess({
      targetUserId: result.data!.targetUserId,
      type: result.data!.type,
      blocked: result.data!.blocked,
    });
  } catch (err) {
    console.error("Live class moderate error:", err);
    return apiError(500, "Internal server error.");
  }
}
