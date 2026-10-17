/**
 * CodingKida — Live Class service (ISOLATED MODULE)
 *
 * Orchestrates the live-class lifecycle: DB rows (LiveClass / LiveParticipant)
 * + the Chime control plane (chime.ts). Routes stay thin — ALL business rules,
 * access decisions and Chime calls live here, so both desktop (teacher) and
 * mobile/desktop (students) hit identical, tested logic (no duplication).
 *
 * Isolation: only touches the standalone live-* tables + chime.ts +
 * live-permissions.ts. It never writes to Course / User / Enrollment.
 *
 * Trust model (PDF §15): callers pass the authenticated userId (derived from
 * the JWT by the route). The client NEVER supplies role, meetingId, or
 * attendee identity — those are derived/loaded here from the DB and Chime.
 */

import { prisma } from "@/app/lib/prisma";
import {
  createChimeMeeting,
  createChimeAttendee,
  deleteChimeMeeting,
  getChimeMeeting,
} from "@/app/lib/live/chime";
import {
  isCourseInstructor,
  resolveJoinAccess,
} from "@/app/lib/live/live-permissions";
import { CHIME_MEDIA_REGION } from "@/app/lib/live/live-config";
import { startMediaCapture, stopMediaCapture } from "@/app/lib/live/recording";
import {
  getSignedFileUrl,
  getSignedFileUrlFromUrl,
  getS3KeyFromUrl,
} from "@/app/lib/s3";
import { getEnrolledCourseIds } from "@/app/repositories/enrollment.repository";

/** Result wrapper so routes can map {ok,status,message} → apiSuccess/apiError. */
export interface ServiceResult<T> {
  ok: boolean;
  status: number;
  message?: string;
  data?: T;
}

function fail<T>(status: number, message: string): ServiceResult<T> {
  return { ok: false, status, message };
}
function ok<T>(data: T, status = 200): ServiceResult<T> {
  return { ok: true, status, data };
}

/** Public-safe view of a LiveClass (no internal churn exposed). */
export interface LiveClassDTO {
  id: string;
  courseId: string;
  hostUserId: string;
  title: string;
  instructorName: string;
  durationMinutes: number | null;
  agenda: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  mediaRegion: string;
  recordingUrl: string | null;
  createdAt: string;
}

type LiveClassRow = {
  id: string;
  courseId: string;
  hostUserId: string;
  chimeMeetingId: string;
  mediaRegion: string;
  title: string;
  instructorName: string;
  durationMinutes: number | null;
  agenda: string;
  status: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  recordingUrl: string | null;
  createdAt: Date;
};

function toDTO(c: LiveClassRow): LiveClassDTO {
  return {
    id: c.id,
    courseId: c.courseId,
    hostUserId: c.hostUserId,
    title: c.title,
    instructorName: c.instructorName,
    durationMinutes: c.durationMinutes,
    agenda: c.agenda,
    status: c.status,
    scheduledAt: c.scheduledAt ? c.scheduledAt.toISOString() : null,
    startedAt: c.startedAt ? c.startedAt.toISOString() : null,
    endedAt: c.endedAt ? c.endedAt.toISOString() : null,
    mediaRegion: c.mediaRegion,
    recordingUrl: c.recordingUrl,
    createdAt: c.createdAt.toISOString(),
  };
}

/**
 * Schedule / create a live class. Only the course instructor (or creator) may
 * create a class for that course. Does NOT touch Chime — the meeting is created
 * lazily on start (so no cost/resource is reserved for a class that may never
 * run).
 */
export async function createLiveClass(opts: {
  requesterId: string;
  courseId: string;
  title?: string;
  instructorName?: string;
  durationMinutes?: number | null;
  agenda?: string;
  scheduledAt?: string | null;
}): Promise<ServiceResult<LiveClassDTO>> {
  const courseId = (opts.courseId || "").trim();
  if (!courseId) return fail(400, "courseId is required.");

  // Only the instructor/owner of the course can schedule a class for it.
  if (!(await isCourseInstructor(opts.requesterId, courseId))) {
    return fail(403, "Only the course instructor can schedule a live class.");
  }

  let scheduledAt: Date | null = null;
  if (opts.scheduledAt) {
    const d = new Date(opts.scheduledAt);
    if (isNaN(d.getTime())) return fail(400, "scheduledAt is not a valid date.");
    scheduledAt = d;
  }

  // Normalize duration: a positive integer within a sane cap, else null.
  let durationMinutes: number | null = null;
  if (opts.durationMinutes != null) {
    const n = Math.round(Number(opts.durationMinutes));
    if (Number.isFinite(n) && n > 0 && n <= 24 * 60) durationMinutes = n;
  }

  const created = await prisma.liveClass.create({
    data: {
      courseId,
      hostUserId: opts.requesterId,
      title: (opts.title || "").trim(),
      instructorName: (opts.instructorName || "").trim().slice(0, 120),
      durationMinutes,
      agenda: (opts.agenda || "").trim().slice(0, 2000),
      scheduledAt,
      status: "scheduled",
    },
  });

  return ok(toDTO(created), 201);
}

/**
 * List a course's live classes (newest first). Instructor/owner only — this is
 * the admin management view. Isolated read; no Chime calls.
 */
export async function listLiveClasses(opts: {
  requesterId: string;
  courseId: string;
}): Promise<ServiceResult<{ classes: LiveClassDTO[] }>> {
  const courseId = (opts.courseId || "").trim();
  if (!courseId) return fail(400, "courseId is required.");

  if (!(await isCourseInstructor(opts.requesterId, courseId))) {
    return fail(403, "Only the course instructor can view its live classes.");
  }

  const rows = await prisma.liveClass.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
  });

  return ok({ classes: rows.map(toDTO) });
}

/**
 * List the live classes a STUDENT can see — scheduled + live classes across the
 * courses they're enrolled in (newest-relevant first). Ended/cancelled are
 * omitted (students join upcoming/live; recordings are a separate flow). Course
 * titles are resolved in one read-only batch (no FK, keeps the feature isolated).
 */
export async function listStudentClasses(opts: {
  requesterId: string;
}): Promise<ServiceResult<{ classes: (LiveClassDTO & { courseTitle: string })[] }>> {
  const courseIds = await getEnrolledCourseIds(opts.requesterId);
  if (courseIds.length === 0) return ok({ classes: [] });

  const rows = await prisma.liveClass.findMany({
    where: { courseId: { in: courseIds }, status: { in: ["scheduled", "live"] } },
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
  });
  if (rows.length === 0) return ok({ classes: [] });

  // Resolve course titles once (read-only; no relation = isolation preserved).
  const uniqueCourseIds = [...new Set(rows.map((r) => r.courseId))];
  const courses = await prisma.course.findMany({
    where: { id: { in: uniqueCourseIds } },
    select: { id: true, title: true },
  });
  const titleMap = new Map(courses.map((c) => [c.id, c.title]));

  const classes = rows.map((r) => ({
    ...toDTO(r),
    courseTitle: titleMap.get(r.courseId) || "",
  }));
  return ok({ classes });
}

/**
 * List the live classes a TEACHER hosts — scheduled + live classes where they
 * are the host (the account that scheduled them from the admin panel). Used by
 * the desktop teacher view to Start Now / Rejoin / End. Course titles resolved
 * in one read-only batch (no FK → isolation preserved). Mirrors
 * listStudentClasses so both views share the same shape.
 */
export async function listHostingClasses(opts: {
  requesterId: string;
}): Promise<ServiceResult<{ classes: (LiveClassDTO & { courseTitle: string })[] }>> {
  const rows = await prisma.liveClass.findMany({
    where: { hostUserId: opts.requesterId, status: { in: ["scheduled", "live"] } },
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
  });
  if (rows.length === 0) return ok({ classes: [] });

  const uniqueCourseIds = [...new Set(rows.map((r) => r.courseId))];
  const courses = await prisma.course.findMany({
    where: { id: { in: uniqueCourseIds } },
    select: { id: true, title: true },
  });
  const titleMap = new Map(courses.map((c) => [c.id, c.title]));

  const classes = rows.map((r) => ({
    ...toDTO(r),
    courseTitle: titleMap.get(r.courseId) || "",
  }));
  return ok({ classes });
}

/**
 * Cancel a scheduled class (instructor action). Only a not-yet-ended class can
 * be cancelled. Idempotent: cancelling an already-cancelled class is a no-op
 * success. A live class should be ended (not cancelled) — guarded below.
 */
export async function cancelLiveClass(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<LiveClassDTO>> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  const isHost = liveClass.hostUserId === opts.requesterId;
  if (!isHost && !(await isCourseInstructor(opts.requesterId, liveClass.courseId))) {
    return fail(403, "Only the instructor can cancel this class.");
  }

  if (liveClass.status === "cancelled") return ok(toDTO(liveClass));
  if (liveClass.status === "live") {
    return fail(409, "A live class is running — end it instead of cancelling.");
  }
  if (liveClass.status === "ended") {
    return fail(409, "This class has already ended.");
  }

  const updated = await prisma.liveClass.update({
    where: { id: liveClass.id },
    data: { status: "cancelled" },
  });
  return ok(toDTO(updated));
}

/**
 * Fetch a class by id. Access: host, course instructor, or enrolled student.
 */
export async function getLiveClass(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<LiveClassDTO>> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  const access = await resolveJoinAccess(opts.requesterId, {
    courseId: liveClass.courseId,
    hostUserId: liveClass.hostUserId,
  });
  if (!access.allowed) return fail(403, "You don't have access to this class.");

  return ok(toDTO(liveClass));
}

/**
 * Start a class (teacher action). Creates the Chime meeting (idempotent on the
 * LiveClass id) and flips status → "live". Only the host/instructor may start.
 * Returns the Chime Meeting object the client SDK needs to connect.
 */
export async function startLiveClass(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<
  ServiceResult<{ liveClass: LiveClassDTO; meeting: unknown }>
> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  // Only the host, or the course instructor/owner, can start.
  const isHost = liveClass.hostUserId === opts.requesterId;
  if (!isHost && !(await isCourseInstructor(opts.requesterId, liveClass.courseId))) {
    return fail(403, "Only the instructor can start this class.");
  }

  if (liveClass.status === "ended" || liveClass.status === "cancelled") {
    return fail(409, "This class has already ended.");
  }

  // Create (or reuse, via idempotent ClientRequestToken) the Chime meeting.
  const meeting = await createChimeMeeting(liveClass.id);

  const updated = await prisma.liveClass.update({
    where: { id: liveClass.id },
    data: {
      chimeMeetingId: meeting.MeetingId!,
      mediaRegion: meeting.MediaRegion || CHIME_MEDIA_REGION,
      status: "live",
      startedAt: liveClass.startedAt ?? new Date(),
    },
  });

  return ok({ liveClass: toDTO(updated), meeting });
}

/**
 * Join a class. Access: host, instructor, or enrolled student. Returns the
 * Chime Meeting + the caller's Attendee (JoinToken) so the client SDK can
 * connect. Attendance is recorded/updated in LiveParticipant.
 *
 * The meetingId is loaded from the DB (never trusted from the client), and the
 * attendee ExternalUserId is the authenticated user's id.
 */
export async function joinLiveClass(opts: {
  requesterId: string;
  liveClassId: string;
  clientType?: string;
}): Promise<
  ServiceResult<{ liveClass: LiveClassDTO; meeting: unknown; attendee: unknown }>
> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  if (liveClass.status !== "live") {
    return fail(409, "This class is not live yet.");
  }
  if (!liveClass.chimeMeetingId) {
    return fail(409, "This class has no active meeting.");
  }

  const access = await resolveJoinAccess(opts.requesterId, {
    courseId: liveClass.courseId,
    hostUserId: liveClass.hostUserId,
  });
  if (!access.allowed) return fail(403, "You don't have access to this class.");

  // Host force-remove (Phase 4): a removed user cannot rejoin until the host
  // approves. The host themselves is never blocked. We return 403 so the client
  // can show an "ask to rejoin" flow. The host is identified by role=teacher.
  if (access.role !== "teacher") {
    const me = await prisma.liveParticipant.findUnique({
      where: { liveClassId_userId: { liveClassId: liveClass.id, userId: opts.requesterId } },
      select: { removed: true },
    });
    if (me?.removed) {
      return fail(403, "The host removed you from this class. You can request to rejoin.");
    }
  }

  // Load the full Chime meeting (incl. MediaPlacement) the client SDK needs to
  // connect. If Chime no longer has it, the meeting effectively ended.
  const meeting = await getChimeMeeting(liveClass.chimeMeetingId);
  if (!meeting) {
    return fail(409, "This class's meeting is no longer active.");
  }

  // Create a Chime attendee for this user (server derives identity).
  const attendee = await createChimeAttendee(
    liveClass.chimeMeetingId,
    opts.requesterId
  );

  // Record / refresh attendance. Unique on (liveClassId, userId): a rejoin
  // updates the same row (new attendee id, clear leftAt) instead of duplicating.
  const clientType = normalizeClientType(opts.clientType);
  await prisma.liveParticipant.upsert({
    where: {
      liveClassId_userId: { liveClassId: liveClass.id, userId: opts.requesterId },
    },
    create: {
      liveClassId: liveClass.id,
      userId: opts.requesterId,
      role: access.role,
      clientType,
      chimeAttendeeId: attendee.AttendeeId || "",
    },
    update: {
      role: access.role,
      clientType,
      chimeAttendeeId: attendee.AttendeeId || "",
      leftAt: null,
      joinedAt: new Date(),
    },
  });

  return ok({ liveClass: toDTO(liveClass), meeting, attendee });
}

/**
 * Mark the caller as having left the class (attendance). Best-effort: a user
 * who never joined simply has nothing to update.
 */
export async function leaveLiveClass(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<{ left: boolean }>> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
    select: { id: true },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  const participant = await prisma.liveParticipant.findUnique({
    where: {
      liveClassId_userId: { liveClassId: opts.liveClassId, userId: opts.requesterId },
    },
    select: { id: true, leftAt: true },
  });
  if (!participant) return ok({ left: false });

  if (!participant.leftAt) {
    await prisma.liveParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });
  }
  return ok({ left: true });
}

/** Public-safe view of one live-class participant (roster entry). */
export interface LiveParticipantDTO {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string; // teacher | student
  joinedAt: string;
  // Host-moderation state (Phase 7) so the host UI can reflect current toggles.
  audioBlocked: boolean;
  videoBlocked: boolean;
  chatBlocked: boolean;
}

/**
 * List the CURRENT participants of a live class (those who have joined and not
 * left) — the roster that powers the Zoom-style participants panel. Access:
 * host, course instructor, or enrolled student (same as join access).
 *
 * Identity (name + avatar) is resolved server-side from the User table in one
 * batch read — the client never sends it. Avatars are returned as short-lived
 * signed URLs (best-effort; a failure just yields null so the UI falls back to
 * an initial). Isolation preserved: only reads User (no writes, no new FK).
 */
export async function listLiveParticipants(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<{ participants: LiveParticipantDTO[] }>> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
    select: { id: true, courseId: true, hostUserId: true },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  const access = await resolveJoinAccess(opts.requesterId, {
    courseId: liveClass.courseId,
    hostUserId: liveClass.hostUserId,
  });
  if (!access.allowed) return fail(403, "You don't have access to this class.");

  // Currently-present participants = joined and not yet left.
  const rows = await prisma.liveParticipant.findMany({
    where: { liveClassId: liveClass.id, leftAt: null },
    select: {
      userId: true,
      role: true,
      joinedAt: true,
      audioBlocked: true,
      videoBlocked: true,
      chatBlocked: true,
    },
    orderBy: { joinedAt: "asc" },
  });
  if (rows.length === 0) return ok({ participants: [] });

  // Batch-resolve names + avatars (one read, no per-row round-trips).
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatarUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Sign avatars best-effort (never fail the whole roster for one bad URL).
  const participants: LiveParticipantDTO[] = await Promise.all(
    rows.map(async (r) => {
      const u = userMap.get(r.userId);
      let avatarUrl: string | null = null;
      if (u?.avatarUrl) {
        try {
          avatarUrl = getS3KeyFromUrl(u.avatarUrl)
            ? await getSignedFileUrlFromUrl(u.avatarUrl, 86400)
            : u.avatarUrl;
        } catch {
          avatarUrl = null;
        }
      }
      return {
        userId: r.userId,
        name: u?.name || "Participant",
        avatarUrl,
        role: r.role,
        joinedAt: r.joinedAt.toISOString(),
        audioBlocked: r.audioBlocked,
        videoBlocked: r.videoBlocked,
        chatBlocked: r.chatBlocked,
      };
    })
  );

  return ok({ participants });
}

/**
 * Host BULK moderation (Phase 7): enable/disable audio, video, or chat for ALL
 * participants of a class in one operation. Host/instructor only. Scales to any
 * class size — a single `updateMany` (plus the client sends one broadcast). The
 * host themselves is excluded so a host never blocks their own A/V/chat.
 */
export async function moderateAllParticipants(opts: {
  requesterId: string;
  liveClassId: string;
  type: "audio" | "video" | "chat";
  blocked: boolean;
}): Promise<ServiceResult<{ type: string; blocked: boolean; count: number }>> {
  if (!["audio", "video", "chat"].includes(opts.type)) {
    return fail(400, "Invalid moderation type.");
  }

  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
    select: { id: true, courseId: true, hostUserId: true },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  const isHost = liveClass.hostUserId === opts.requesterId;
  if (!isHost && !(await isCourseInstructor(opts.requesterId, liveClass.courseId))) {
    return fail(403, "Only the host can moderate participants.");
  }

  const data =
    opts.type === "audio"
      ? { audioBlocked: opts.blocked }
      : opts.type === "video"
      ? { videoBlocked: opts.blocked }
      : { chatBlocked: opts.blocked };

  // Apply to everyone in this class EXCEPT the requester (the host).
  const result = await prisma.liveParticipant.updateMany({
    where: { liveClassId: liveClass.id, userId: { not: opts.requesterId } },
    data,
  });

  return ok({ type: opts.type, blocked: opts.blocked, count: result.count });
}

/** Shared host-authorization + class load for per-participant host actions. */
async function _loadClassForHost(
  requesterId: string,
  liveClassId: string
): Promise<
  | { ok: true; liveClass: { id: string; courseId: string; hostUserId: string } }
  | { ok: false; status: number; message: string }
> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: liveClassId },
    select: { id: true, courseId: true, hostUserId: true },
  });
  if (!liveClass) return { ok: false, status: 404, message: "Live class not found." };
  const isHost = liveClass.hostUserId === requesterId;
  if (!isHost && !(await isCourseInstructor(requesterId, liveClass.courseId))) {
    return { ok: false, status: 403, message: "Only the host can do this." };
  }
  return { ok: true, liveClass };
}

/**
 * Host PER-PARTICIPANT moderation (Phase 4): enable/disable one participant's
 * audio, video, or chat. Host/instructor only. Complements the bulk variant.
 */
export async function moderateParticipant(opts: {
  requesterId: string;
  liveClassId: string;
  targetUserId: string;
  type: "audio" | "video" | "chat";
  blocked: boolean;
}): Promise<ServiceResult<{ targetUserId: string; type: string; blocked: boolean }>> {
  const targetUserId = (opts.targetUserId || "").trim();
  if (!targetUserId) return fail(400, "targetUserId is required.");
  if (!["audio", "video", "chat"].includes(opts.type)) return fail(400, "Invalid moderation type.");

  const access = await _loadClassForHost(opts.requesterId, opts.liveClassId);
  if (!access.ok) return fail(access.status, access.message);
  if (targetUserId === opts.requesterId) return fail(400, "You can't moderate yourself.");

  const participant = await prisma.liveParticipant.findUnique({
    where: { liveClassId_userId: { liveClassId: access.liveClass.id, userId: targetUserId } },
    select: { id: true },
  });
  if (!participant) return fail(404, "That participant is not in this class.");

  const data =
    opts.type === "audio" ? { audioBlocked: opts.blocked }
    : opts.type === "video" ? { videoBlocked: opts.blocked }
    : { chatBlocked: opts.blocked };
  await prisma.liveParticipant.update({ where: { id: participant.id }, data });

  return ok({ targetUserId, type: opts.type, blocked: opts.blocked });
}

/**
 * Host FORCE-REMOVE (Phase 4): remove a participant from the class. Marks the
 * row `removed` so a later join needs host approval. The host client also
 * broadcasts a real-time signal so the target's room closes immediately.
 */
export async function removeParticipant(opts: {
  requesterId: string;
  liveClassId: string;
  targetUserId: string;
}): Promise<ServiceResult<{ targetUserId: string }>> {
  const targetUserId = (opts.targetUserId || "").trim();
  if (!targetUserId) return fail(400, "targetUserId is required.");

  const access = await _loadClassForHost(opts.requesterId, opts.liveClassId);
  if (!access.ok) return fail(access.status, access.message);
  if (targetUserId === opts.requesterId) return fail(400, "You can't remove yourself.");

  const participant = await prisma.liveParticipant.findUnique({
    where: { liveClassId_userId: { liveClassId: access.liveClass.id, userId: targetUserId } },
    select: { id: true },
  });
  if (!participant) return fail(404, "That participant is not in this class.");

  await prisma.liveParticipant.update({
    where: { id: participant.id },
    data: { removed: true, rejoinRequestedAt: null, leftAt: new Date() },
  });
  return ok({ targetUserId });
}

/**
 * A removed user asks to REJOIN (Phase 4). Records the request so the host sees
 * it in the roster and can accept/reject. If the user wasn't actually removed,
 * this is a no-op success (they can just join normally).
 */
export async function requestRejoin(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<{ pending: boolean }>> {
  const participant = await prisma.liveParticipant.findUnique({
    where: { liveClassId_userId: { liveClassId: opts.liveClassId, userId: opts.requesterId } },
    select: { id: true, removed: true },
  });
  if (!participant || !participant.removed) return ok({ pending: false });

  await prisma.liveParticipant.update({
    where: { id: participant.id },
    data: { rejoinRequestedAt: new Date() },
  });
  return ok({ pending: true });
}

/**
 * Host responds to a rejoin request (Phase 4). accept → clears `removed` so the
 * user can join again; reject → keeps them removed but clears the pending flag.
 */
export async function respondRejoin(opts: {
  requesterId: string;
  liveClassId: string;
  targetUserId: string;
  accept: boolean;
}): Promise<ServiceResult<{ targetUserId: string; accepted: boolean }>> {
  const targetUserId = (opts.targetUserId || "").trim();
  if (!targetUserId) return fail(400, "targetUserId is required.");

  const access = await _loadClassForHost(opts.requesterId, opts.liveClassId);
  if (!access.ok) return fail(access.status, access.message);

  const participant = await prisma.liveParticipant.findUnique({
    where: { liveClassId_userId: { liveClassId: access.liveClass.id, userId: targetUserId } },
    select: { id: true },
  });
  if (!participant) return fail(404, "That participant is not in this class.");

  await prisma.liveParticipant.update({
    where: { id: participant.id },
    data: opts.accept
      ? { removed: false, rejoinRequestedAt: null }
      : { rejoinRequestedAt: null },
  });
  return ok({ targetUserId, accepted: opts.accept });
}

/**
 * Pending rejoin requests for a class (host polls this). Returns users who were
 * removed and have an outstanding rejoin request, with names for the prompt.
 */
export async function listRejoinRequests(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<{ requests: { userId: string; name: string; requestedAt: string }[] }>> {
  const access = await _loadClassForHost(opts.requesterId, opts.liveClassId);
  if (!access.ok) return fail(access.status, access.message);

  const rows = await prisma.liveParticipant.findMany({
    where: { liveClassId: access.liveClass.id, removed: true, rejoinRequestedAt: { not: null } },
    select: { userId: true, rejoinRequestedAt: true },
    orderBy: { rejoinRequestedAt: "asc" },
  });
  if (rows.length === 0) return ok({ requests: [] });

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.name || "Participant"]));

  return ok({
    requests: rows.map((r) => ({
      userId: r.userId,
      name: nameMap.get(r.userId) || "Participant",
      requestedAt: r.rejoinRequestedAt!.toISOString(),
    })),
  });
}

/**
 * End a class (teacher action). Deletes the Chime meeting and flips status →
 * "ended". Only the host/instructor may end. Idempotent: ending an already
 * ended class is a no-op success.
 */
export async function endLiveClass(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<LiveClassDTO>> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  const isHost = liveClass.hostUserId === opts.requesterId;
  if (!isHost && !(await isCourseInstructor(opts.requesterId, liveClass.courseId))) {
    return fail(403, "Only the instructor can end this class.");
  }

  if (liveClass.status === "ended") {
    return ok(toDTO(liveClass));
  }

  // Tear down the Chime meeting (idempotent inside deleteChimeMeeting).
  if (liveClass.chimeMeetingId) {
    await deleteChimeMeeting(liveClass.chimeMeetingId);
  }

  const now = new Date();
  const updated = await prisma.liveClass.update({
    where: { id: liveClass.id },
    data: { status: "ended", endedAt: now },
  });

  // Close out any participants still marked as present (attendance accuracy).
  await prisma.liveParticipant.updateMany({
    where: { liveClassId: liveClass.id, leftAt: null },
    data: { leftAt: now },
  });

  return ok(toDTO(updated));
}

/** Participant (attendance) view for the host dashboard. */
export interface ParticipantDTO {
  userId: string;
  role: string;
  clientType: string;
  joinedAt: string;
  leftAt: string | null;
  present: boolean;
}

/**
 * List participants of a class (attendance). Access: host/instructor only —
 * attendance is teacher-facing data.
 */
export async function listParticipants(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<{ participants: ParticipantDTO[] }>> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
    select: { id: true, courseId: true, hostUserId: true },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  const isHost = liveClass.hostUserId === opts.requesterId;
  if (!isHost && !(await isCourseInstructor(opts.requesterId, liveClass.courseId))) {
    return fail(403, "Only the instructor can view attendance.");
  }

  const rows = await prisma.liveParticipant.findMany({
    where: { liveClassId: liveClass.id },
    orderBy: { joinedAt: "asc" },
    select: {
      userId: true,
      role: true,
      clientType: true,
      joinedAt: true,
      leftAt: true,
    },
  });

  const participants: ParticipantDTO[] = rows.map((p) => ({
    userId: p.userId,
    role: p.role,
    clientType: p.clientType,
    joinedAt: p.joinedAt.toISOString(),
    leftAt: p.leftAt ? p.leftAt.toISOString() : null,
    present: !p.leftAt,
  }));

  return ok({ participants });
}

/** Allow only the known client-type values; default to "" otherwise. */
function normalizeClientType(v?: string): string {
  const allowed = ["TEACHER_DESKTOP", "STUDENT_DESKTOP", "STUDENT_MOBILE"];
  const t = (v || "").trim().toUpperCase();
  return allowed.includes(t) ? t : "";
}

// ───────────────────────── Recording (Phase 10) ─────────────────────────
// Server-side Chime Media Capture Pipeline → S3. Host-triggered only. The
// pipeline id is persisted on LiveRecording so stop is reliable. All methods
// are instructor-gated for start/stop; listing is open to class participants.

/** Public-safe view of a recording (S3 details stay internal; URL is signed). */
export interface RecordingDTO {
  id: string;
  liveClassId: string;
  status: string;
  duration: number | null;
  createdAt: string;
  url: string | null; // time-limited signed URL (null while not yet ready)
}

/**
 * Start recording a live class (host action). Starts a Chime media capture
 * pipeline writing to S3 and records a LiveRecording row (status "processing").
 * Idempotent: if an active recording already exists for this class, it is
 * returned instead of starting a second pipeline.
 */
export async function startRecording(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<RecordingDTO>> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  const isHost = liveClass.hostUserId === opts.requesterId;
  if (!isHost && !(await isCourseInstructor(opts.requesterId, liveClass.courseId))) {
    return fail(403, "Only the instructor can record this class.");
  }

  if (liveClass.status !== "live" || !liveClass.chimeMeetingId) {
    return fail(409, "The class must be live to start recording.");
  }

  // Idempotency: reuse an already-active recording for this class.
  const active = await prisma.liveRecording.findFirst({
    where: { liveClassId: liveClass.id, status: "processing" },
    orderBy: { createdAt: "desc" },
  });
  if (active) {
    return ok(toRecordingDTO(active, null));
  }

  const capture = await startMediaCapture({
    chimeMeetingId: liveClass.chimeMeetingId,
    liveClassId: liveClass.id,
  });

  const created = await prisma.liveRecording.create({
    data: {
      liveClassId: liveClass.id,
      pipelineId: capture.pipelineId,
      s3Bucket: capture.s3Bucket,
      s3Key: capture.s3Key,
      status: "processing",
    },
  });

  return ok(toRecordingDTO(created, null), 201);
}

/**
 * Stop recording (host action). Stops the active pipeline and flips the
 * recording → "ready", also setting LiveClass.recordingUrl to the stored key
 * (served as a signed URL on read). Idempotent: no active recording = success.
 */
export async function stopRecording(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<RecordingDTO>> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
    select: { id: true, courseId: true, hostUserId: true },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  const isHost = liveClass.hostUserId === opts.requesterId;
  if (!isHost && !(await isCourseInstructor(opts.requesterId, liveClass.courseId))) {
    return fail(403, "Only the instructor can stop recording.");
  }

  const active = await prisma.liveRecording.findFirst({
    where: { liveClassId: liveClass.id, status: "processing" },
    orderBy: { createdAt: "desc" },
  });
  if (!active) return fail(409, "No active recording to stop.");

  // Tear down the pipeline (idempotent inside stopMediaCapture).
  if (active.pipelineId) {
    await stopMediaCapture(active.pipelineId);
  }

  const updated = await prisma.liveRecording.update({
    where: { id: active.id },
    data: { status: "ready" },
  });

  // Point the class at its latest recording key (signed on read).
  await prisma.liveClass.update({
    where: { id: liveClass.id },
    data: { recordingUrl: updated.s3Key },
  });

  const url = await safeSignRecording(updated.s3Key);
  return ok(toRecordingDTO(updated, url));
}

/**
 * List a class's recordings with time-limited signed URLs. Access: host,
 * instructor, or enrolled student (recordings are course content for members).
 */
export async function listRecordings(opts: {
  requesterId: string;
  liveClassId: string;
}): Promise<ServiceResult<{ recordings: RecordingDTO[] }>> {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: opts.liveClassId },
    select: { id: true, courseId: true, hostUserId: true },
  });
  if (!liveClass) return fail(404, "Live class not found.");

  const access = await resolveJoinAccess(opts.requesterId, {
    courseId: liveClass.courseId,
    hostUserId: liveClass.hostUserId,
  });
  if (!access.allowed) return fail(403, "You don't have access to these recordings.");

  const rows = await prisma.liveRecording.findMany({
    where: { liveClassId: liveClass.id },
    orderBy: { createdAt: "asc" },
  });

  const recordings = await Promise.all(
    rows.map(async (r) => {
      // Only sign a URL for finished recordings (processing ones aren't playable).
      const url = r.status === "ready" ? await safeSignRecording(r.s3Key) : null;
      return toRecordingDTO(r, url);
    })
  );

  return ok({ recordings });
}

type LiveRecordingRow = {
  id: string;
  liveClassId: string;
  status: string;
  duration: number | null;
  createdAt: Date;
};

function toRecordingDTO(r: LiveRecordingRow, url: string | null): RecordingDTO {
  return {
    id: r.id,
    liveClassId: r.liveClassId,
    status: r.status,
    duration: r.duration,
    createdAt: r.createdAt.toISOString(),
    url,
  };
}

/**
 * Sign a recording's S3 key for playback. Chime writes composited output under
 * the key prefix; we sign the prefix-based key best-effort and never throw (a
 * signing failure just yields a null URL so the API stays resilient).
 */
async function safeSignRecording(s3Key: string): Promise<string | null> {
  if (!s3Key) return null;
  try {
    return await getSignedFileUrl(s3Key);
  } catch {
    return null;
  }
}
