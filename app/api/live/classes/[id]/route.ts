import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { getLiveClass, updateLiveClass } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes/[id]
 *
 * Fetch a live class's details. Access: host, course instructor, or an
 * enrolled student (enforced in the service).
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

    const result = await getLiveClass({
      requesterId: user!.userId,
      liveClassId: id.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Not found.");
    return apiSuccess({ liveClass: result.data });
  } catch (err) {
    console.error("Live class get error:", err);
    return apiError(500, "Internal server error.");
  }
}

/**
 * PATCH /api/live/classes/[id]
 * Body: { title?, instructorName?, durationMinutes?, agenda?, scheduledAt? }
 *
 * Edit a SCHEDULED live class (instructor only — enforced in the service). Only
 * provided fields are changed; a live/ended/cancelled class can't be edited.
 * On success the service re-notifies enrolled students about the update.
 */
export async function PATCH(
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
    const { title, instructorName, durationMinutes, agenda, scheduledAt } = body as {
      title?: string;
      instructorName?: string;
      durationMinutes?: number | null;
      agenda?: string;
      scheduledAt?: string | null;
    };

    const result = await updateLiveClass({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      title,
      instructorName,
      durationMinutes,
      agenda,
      scheduledAt,
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to update class.");
    return apiSuccess({ liveClass: result.data });
  } catch (err) {
    console.error("Live class update error:", err);
    return apiError(500, "Internal server error.");
  }
}
