import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { toggleReaction } from "@/app/lib/live/live-chat";

/**
 * POST /api/live/classes/[id]/reactions
 * Body: { messageId, reaction }
 *
 * Toggle a reaction on a chat message (add if new, remove if the same reaction
 * already exists for this user). Persistence only — real-time fan-out is done
 * client-side via Chime Data Messages. Access: host, instructor, or enrolled
 * student (enforced in the service). Returns the resulting reacted state.
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
    const { messageId, reaction } = body as {
      messageId?: string;
      reaction?: string;
    };

    if (!messageId?.trim()) return apiError(400, "messageId is required.");

    const result = await toggleReaction({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      messageId: messageId.trim(),
      reaction: reaction || "",
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to react.");
    return apiSuccess(
      {
        reacted: result.data!.reacted,
        reaction: result.data!.reaction,
        messageId: result.data!.messageId,
      },
      result.status
    );
  } catch (err) {
    console.error("Live reaction POST error:", err);
    return apiError(500, "Internal server error.");
  }
}
