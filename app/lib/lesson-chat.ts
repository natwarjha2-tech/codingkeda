/**
 * CodingKida — Lesson Q&A Chat Service
 *
 * Business logic for the lesson-level group chat (students of a course ask
 * doubts on a specific lesson; the course instructor replies). Kept separate
 * from the route handlers so both the REST API and the SSE stream can reuse it
 * without duplicating logic.
 *
 * Conventions mirror the rest of the codebase:
 * - Lesson → Course resolved via lesson.module.course (no lesson.courseId column).
 * - Instructor identified by Course.instructorEmail → User.email (unique).
 * - "Enrolled students" = Enrollment rows for the course.
 */

import { prisma } from "@/app/lib/prisma";
import {
  notifyLessonQuestion,
  notifyLessonAnswer,
} from "@/app/lib/notification";

const PREVIEW_MAX = 120;

export interface LessonChatContext {
  lessonId: string;
  courseId: string;
  courseTitle: string;
  lessonTitle: string;
  instructorEmail: string;
  instructorUserId: string | null; // resolved from instructorEmail (may be null if unset)
}

/**
 * Resolve a lesson's course context + instructor account.
 * Returns null if the lesson doesn't exist.
 */
export async function resolveLessonContext(
  lessonId: string
): Promise<LessonChatContext | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      module: {
        select: {
          course: {
            select: { id: true, title: true, instructorEmail: true },
          },
        },
      },
    },
  });

  const course = lesson?.module?.course;
  if (!lesson || !course) return null;

  // Resolve the instructor's user account from the course's instructor email.
  let instructorUserId: string | null = null;
  const email = (course.instructorEmail || "").trim().toLowerCase();
  if (email) {
    const instructor = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    instructorUserId = instructor?.id ?? null;
  }

  return {
    lessonId: lesson.id,
    courseId: course.id,
    courseTitle: course.title,
    lessonTitle: lesson.title,
    instructorEmail: email,
    instructorUserId,
  };
}

export interface ChatMessageDTO {
  id: string;
  lessonId: string;
  courseId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  text: string;
  parentId: string | null;
  createdAt: string;
  isMine?: boolean;
}

/**
 * Fetch a lesson's chat messages (oldest → newest), enriched with sender names.
 * `after` (ISO timestamp) fetches only messages newer than it (for polling/SSE).
 */
export async function getLessonMessages(
  lessonId: string,
  opts: { after?: string; viewerId?: string; limit?: number } = {}
): Promise<ChatMessageDTO[]> {
  const limit = Math.min(opts.limit || 200, 500);
  const where: { lessonId: string; createdAt?: { gt: Date } } = { lessonId };
  if (opts.after) where.createdAt = { gt: new Date(opts.after) };

  const messages = await prisma.lessonChatMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  // Resolve sender names in one query (no N+1).
  const senderIds = [...new Set(messages.map((m) => m.senderId))];
  const users = senderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: senderIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name || "User"]));

  return messages.map((m) => ({
    id: m.id,
    lessonId: m.lessonId,
    courseId: m.courseId,
    senderId: m.senderId,
    senderRole: m.senderRole,
    senderName: nameMap.get(m.senderId) || "User",
    text: m.text,
    parentId: m.parentId,
    createdAt: m.createdAt.toISOString(),
    isMine: opts.viewerId ? m.senderId === opts.viewerId : undefined,
  }));
}

export interface PostMessageResult {
  ok: boolean;
  status: number;
  message?: string;
  data?: ChatMessageDTO;
}

/**
 * Post a message to a lesson chat.
 * - Determines whether the sender is the course instructor or an enrolled student.
 * - Enforces access: only the course instructor OR an enrolled student may post.
 * - Fires notifications: student → instructor; instructor → all enrolled students.
 */
export async function postLessonMessage(opts: {
  lessonId: string;
  senderId: string;
  senderName: string;
  text: string;
  parentId?: string | null;
}): Promise<PostMessageResult> {
  const text = (opts.text || "").trim();
  if (!text) return { ok: false, status: 400, message: "Message text is required." };
  if (text.length > 4000)
    return { ok: false, status: 400, message: "Message is too long (max 4000 chars)." };

  const ctx = await resolveLessonContext(opts.lessonId);
  if (!ctx) return { ok: false, status: 404, message: "Lesson not found." };

  // Determine sender role via instructor match, else enrollment check.
  const isInstructor = !!ctx.instructorUserId && ctx.instructorUserId === opts.senderId;

  let isEnrolledStudent = false;
  if (!isInstructor) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: opts.senderId, courseId: ctx.courseId } },
      select: { id: true },
    });
    isEnrolledStudent = !!enrollment;
  }

  if (!isInstructor && !isEnrolledStudent) {
    return {
      ok: false,
      status: 403,
      message: "Only the course instructor or enrolled students can post here.",
    };
  }

  const senderRole = isInstructor ? "instructor" : "student";

  // Create the message.
  const created = await prisma.lessonChatMessage.create({
    data: {
      lessonId: ctx.lessonId,
      courseId: ctx.courseId,
      senderId: opts.senderId,
      senderRole,
      text,
      parentId: opts.parentId?.trim() || null,
    },
  });

  const preview = text.length > PREVIEW_MAX ? text.slice(0, PREVIEW_MAX) + "…" : text;

  // Fire notifications (non-blocking failures must not break message creation).
  try {
    if (senderRole === "student") {
      // Notify the course instructor (if their account is resolved).
      if (ctx.instructorUserId) {
        await notifyLessonQuestion({
          instructorUserId: ctx.instructorUserId,
          lessonId: ctx.lessonId,
          courseId: ctx.courseId,
          messageId: created.id,
          studentName: opts.senderName || "A student",
          lessonTitle: ctx.lessonTitle,
          courseTitle: ctx.courseTitle,
          preview,
        });
      }
    } else {
      // Instructor replied → notify every enrolled student (skip the instructor).
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: ctx.courseId },
        select: { userId: true },
      });
      await Promise.all(
        enrollments
          .filter((e) => e.userId !== opts.senderId)
          .map((e) =>
            notifyLessonAnswer({
              userId: e.userId,
              lessonId: ctx.lessonId,
              courseId: ctx.courseId,
              messageId: created.id,
              lessonTitle: ctx.lessonTitle,
              courseTitle: ctx.courseTitle,
              preview,
            })
          )
      );
    }
  } catch {
    // Notification failure is non-fatal — the message is already saved.
  }

  return {
    ok: true,
    status: 201,
    data: {
      id: created.id,
      lessonId: created.lessonId,
      courseId: created.courseId,
      senderId: created.senderId,
      senderRole: created.senderRole,
      senderName: opts.senderName || "User",
      text: created.text,
      parentId: created.parentId,
      createdAt: created.createdAt.toISOString(),
      isMine: true,
    },
  };
}
