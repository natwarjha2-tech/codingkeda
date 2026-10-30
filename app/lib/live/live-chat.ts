/**
 * CodingKida — Live Class chat + reactions service (ISOLATED MODULE)
 *
 * PERSISTENCE / HISTORY layer for the in-class chat. Real-time delivery is done
 * client-side via Amazon Chime SDK Data Messages (same media connection as
 * audio/video, micro-second latency, no extra WebSocket server). This service
 * only durably stores messages/reactions and serves history to late joiners or
 * reloads — the two concerns stay cleanly separated.
 *
 * Isolation: touches only the standalone live-* tables (LiveChatMessage,
 * LiveChatReaction) + live-permissions. Never writes to Course / User /
 * Enrollment. Access reuses `resolveJoinAccess` so chat access === class access
 * (host / instructor / enrolled student) — no duplicated permission logic.
 *
 * Trust model (PDF §15): callers pass the authenticated userId (from the JWT).
 * senderRole is derived server-side from access, never trusted from the client.
 */

import { prisma } from "@/app/lib/prisma";
import { resolveJoinAccess } from "@/app/lib/live/live-permissions";
import { LIVE_CHAT_RETENTION_DAYS } from "@/app/lib/live/live-config";

const MESSAGE_MAX = 4000;
const REACTION_MAX = 32;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/** Allowed message types (mirrors schema comment on LiveChatMessage.messageType). */
const MESSAGE_TYPES = ["TEXT", "QUESTION", "ANNOUNCEMENT", "EMOJI", "SYSTEM"] as const;
type MessageType = (typeof MESSAGE_TYPES)[number];

/** Result wrapper so routes can map {ok,status,message} → apiSuccess/apiError. */
export interface ChatServiceResult<T> {
  ok: boolean;
  status: number;
  message?: string;
  data?: T;
}
function fail<T>(status: number, message: string): ChatServiceResult<T> {
  return { ok: false, status, message };
}
function ok<T>(data: T, status = 200): ChatServiceResult<T> {
  return { ok: true, status, data };
}

export interface LiveChatMessageDTO {
  id: string;
  liveClassId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  message: string;
  messageType: string;
  replyToMessageId: string | null;
  createdAt: string;
  isMine?: boolean;
}

/**
 * Load + access-check a class once, returning the fields chat needs. Keeps the
 * three public methods DRY (single source of access truth).
 */
async function loadClassWithAccess(
  requesterId: string,
  liveClassId: string
): Promise<
  | { ok: true; role: "teacher" | "student" }
  | { ok: false; status: number; message: string }
> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: liveClassId },
    select: { id: true, courseId: true, hostUserId: true },
  });
  if (!liveClass) return { ok: false, status: 404, message: "Live class not found." };

  const access = await resolveJoinAccess(requesterId, {
    courseId: liveClass.courseId,
    hostUserId: liveClass.hostUserId,
  });
  if (!access.allowed) {
    return { ok: false, status: 403, message: "You don't have access to this class chat." };
  }
  return { ok: true, role: access.role };
}

/** Normalize + validate the requested message type. Defaults to TEXT. */
function normalizeMessageType(v: string | undefined, isTeacher: boolean): MessageType {
  const t = (v || "TEXT").trim().toUpperCase();
  const type = (MESSAGE_TYPES as readonly string[]).includes(t) ? (t as MessageType) : "TEXT";
  // ANNOUNCEMENT is teacher-only; downgrade to TEXT if a student requests it.
  if (type === "ANNOUNCEMENT" && !isTeacher) return "TEXT";
  // SYSTEM is server-authored only; never accept it from a client.
  if (type === "SYSTEM") return "TEXT";
  return type;
}

/**
 * Post a chat message. Access + role resolved server-side. Returns the stored
 * row so the client can echo it / correlate with the Chime Data Message it also
 * broadcast for real-time delivery.
 */
export async function postChatMessage(opts: {
  requesterId: string;
  requesterName: string;
  liveClassId: string;
  message: string;
  messageType?: string;
  replyToMessageId?: string | null;
}): Promise<ChatServiceResult<LiveChatMessageDTO>> {
  const message = (opts.message || "").trim();
  if (!message) return fail(400, "Message is required.");
  if (message.length > MESSAGE_MAX)
    return fail(400, `Message is too long (max ${MESSAGE_MAX} chars).`);

  const access = await loadClassWithAccess(opts.requesterId, opts.liveClassId);
  if (!access.ok) return fail(access.status, access.message);

  // Host moderation (Phase 7): a participant the host has chat-blocked cannot
  // post. Server-authoritative — enforced here so a tampered client can never
  // bypass it (the message is simply never stored). Teachers are never blocked.
  if (access.role !== "teacher") {
    const me = await prisma.liveParticipant.findUnique({
      where: {
        liveClassId_userId: { liveClassId: opts.liveClassId, userId: opts.requesterId },
      },
      select: { chatBlocked: true },
    });
    if (me?.chatBlocked) {
      return fail(403, "The host has turned off your chat for this class.");
    }
  }

  const isTeacher = access.role === "teacher";
  const messageType = normalizeMessageType(opts.messageType, isTeacher);

  // Validate replyToMessageId (if given) belongs to the SAME class — prevents
  // cross-class reply spoofing.
  let replyToMessageId: string | null = null;
  const replyId = opts.replyToMessageId?.trim();
  if (replyId) {
    const parent = await prisma.liveChatMessage.findUnique({
      where: { id: replyId },
      select: { liveClassId: true },
    });
    if (parent && parent.liveClassId === opts.liveClassId) {
      replyToMessageId = replyId;
    }
    // Silently ignore an invalid/foreign reply target (non-fatal).
  }

  const created = await prisma.liveChatMessage.create({
    data: {
      liveClassId: opts.liveClassId,
      senderId: opts.requesterId,
      senderRole: access.role,
      message,
      messageType,
      replyToMessageId,
    },
  });

  return ok(
    {
      id: created.id,
      liveClassId: created.liveClassId,
      senderId: created.senderId,
      senderRole: created.senderRole,
      senderName: opts.requesterName || "User",
      message: created.message,
      messageType: created.messageType,
      replyToMessageId: created.replyToMessageId,
      createdAt: created.createdAt.toISOString(),
      isMine: true,
    },
    201
  );
}

/**
 * Fetch chat history (oldest → newest). `after` (ISO) returns only newer
 * messages — used by reloads / late joiners to backfill. Sender names resolved
 * in a single query (no N+1), mirroring lesson-chat.
 */
export async function getChatMessages(opts: {
  requesterId: string;
  liveClassId: string;
  after?: string;
  limit?: number;
}): Promise<ChatServiceResult<{ messages: LiveChatMessageDTO[] }>> {
  const access = await loadClassWithAccess(opts.requesterId, opts.liveClassId);
  if (!access.ok) return fail(access.status, access.message);

  const limit = Math.min(opts.limit || DEFAULT_LIMIT, MAX_LIMIT);
  const where: { liveClassId: string; createdAt?: { gt: Date } } = {
    liveClassId: opts.liveClassId,
  };
  if (opts.after) {
    const d = new Date(opts.after);
    if (!isNaN(d.getTime())) where.createdAt = { gt: d };
  }

  const rows = await prisma.liveChatMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  // Resolve sender display names in ONE query (no N+1).
  const senderIds = [...new Set(rows.map((m) => m.senderId))];
  const users = senderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: senderIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name || "User"]));

  const messages: LiveChatMessageDTO[] = rows.map((m) => ({
    id: m.id,
    liveClassId: m.liveClassId,
    senderId: m.senderId,
    senderRole: m.senderRole,
    senderName: nameMap.get(m.senderId) || "User",
    message: m.message,
    messageType: m.messageType,
    replyToMessageId: m.replyToMessageId,
    createdAt: m.createdAt.toISOString(),
    isMine: m.senderId === opts.requesterId,
  }));

  return ok({ messages });
}

/**
 * Toggle a reaction on a chat message. If the same (user, message, reaction)
 * already exists it is REMOVED (toggle off); otherwise it is added. Returns the
 * new state so the client can reflect it. Real-time fan-out is done client-side
 * via Chime Data Messages — this only persists for history/analytics.
 */
export async function toggleReaction(opts: {
  requesterId: string;
  liveClassId: string;
  messageId: string;
  reaction: string;
}): Promise<ChatServiceResult<{ reacted: boolean; reaction: string; messageId: string }>> {
  const reaction = (opts.reaction || "").trim();
  if (!reaction) return fail(400, "Reaction is required.");
  if (reaction.length > REACTION_MAX)
    return fail(400, `Reaction is too long (max ${REACTION_MAX} chars).`);

  const access = await loadClassWithAccess(opts.requesterId, opts.liveClassId);
  if (!access.ok) return fail(access.status, access.message);

  // The message must exist AND belong to this class (no cross-class reactions).
  const target = await prisma.liveChatMessage.findUnique({
    where: { id: opts.messageId },
    select: { id: true, liveClassId: true },
  });
  if (!target || target.liveClassId !== opts.liveClassId) {
    return fail(404, "Message not found in this class.");
  }

  // Toggle: find an existing identical reaction by this user.
  const existing = await prisma.liveChatReaction.findFirst({
    where: { messageId: opts.messageId, userId: opts.requesterId, reaction },
    select: { id: true },
  });

  if (existing) {
    await prisma.liveChatReaction.delete({ where: { id: existing.id } });
    return ok({ reacted: false, reaction, messageId: opts.messageId });
  }

  await prisma.liveChatReaction.create({
    data: { messageId: opts.messageId, userId: opts.requesterId, reaction },
  });
  return ok({ reacted: true, reaction, messageId: opts.messageId }, 201);
}

/**
 * Prune class-chat messages older than the configured retention window
 * (Phase 7 / F19 + L15). OPT-IN + non-destructive-by-default:
 *
 *  - If LIVE_CHAT_RETENTION_DAYS is 0 (the default), this is a NO-OP and returns
 *    0 — nothing is ever deleted. Chat is kept indefinitely until an operator
 *    deliberately sets a retention window.
 *  - When a positive window is configured, it deletes ONLY LiveChatMessage rows
 *    whose createdAt is strictly older than (now − window). The scope is tightly
 *    bounded by that cutoff; it never touches recent messages or any other table.
 *
 * This helper is NOT wired to run automatically. An operator triggers it
 * deliberately (e.g. a one-off script or a secured maintenance call) after
 * reviewing the retention window — keeping the chat data lifecycle explicit and
 * auditable. Reactions cascade off messages only where the app deletes them;
 * here we prune messages only (reactions are lightweight + message-scoped).
 *
 * @returns the number of messages deleted (0 when retention is disabled).
 */
export async function pruneOldChatMessages(): Promise<number> {
  const days = LIVE_CHAT_RETENTION_DAYS;
  if (!Number.isFinite(days) || days <= 0) return 0; // disabled → never deletes

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.liveChatMessage.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
