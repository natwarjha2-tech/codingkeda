import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { getChatMessages, postChatMessage } from "@/app/lib/live/live-chat";

/**
 * GET /api/live/classes/[id]/chat?after=<ISO?>&limit=<n?>
 *
 * Chat history (oldest → newest) for history/late-join backfill. Real-time
 * delivery is handled client-side via Chime Data Messages; this is persistence.
 * Access: host, instructor, or enrolled student (enforced in the service).
 */
export async function GET(
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

    const after = req.nextUrl.searchParams.get("after")?.trim() || undefined;
    const limitRaw = req.nextUrl.searchParams.get("limit")?.trim();
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const result = await getChatMessages({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      after,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to load chat.");
    return apiSuccess({ messages: result.data!.messages });
  } catch (err) {
    console.error("Live chat GET error:", err);
    return apiError(500, "Internal server error.");
  }
}

/**
 * POST /api/live/classes/[id]/chat
 * Body: { message, messageType?, replyToMessageId? }
 *
 * Persist a chat message. senderRole/access derived server-side (never trusted
 * from the client). Returns the stored row so the client can correlate it with
 * the Chime Data Message it broadcasts for real-time delivery.
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
    const { message, messageType, replyToMessageId } = body as {
      message?: string;
      messageType?: string;
      replyToMessageId?: string | null;
    };

    // Sender display name (JWT has no name — fetch once, like lesson-chat).
    const sender = await prisma.user.findUnique({
      where: { id: user!.userId },
      select: { name: true },
    });

    const result = await postChatMessage({
      requesterId: user!.userId,
      requesterName: sender?.name || "User",
      liveClassId: id.trim(),
      message: message || "",
      messageType,
      replyToMessageId: replyToMessageId ?? null,
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to send message.");
    return apiSuccess({ message: result.data }, result.status);
  } catch (err) {
    console.error("Live chat POST error:", err);
    return apiError(500, "Internal server error.");
  }
}
