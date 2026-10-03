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
import { searchChunks } from "@/app/lib/rag";
import { callGemini, isGeminiConfigured } from "@/app/lib/gemini";
import { logger } from "@/app/lib/logger";

const PREVIEW_MAX = 120;

// Sentinel sender identity for AI-authored messages. There is no backing User
// row for this id (chat uses plain-string senderIds, no FK), so name resolution
// special-cases it to "Codo".
export const AI_SENDER_ID = "codo-ai";
export const AI_SENDER_NAME = "Codo";

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
  // AI messages have no User row — resolve their sender name to "Codo".
  nameMap.set(AI_SENDER_ID, AI_SENDER_NAME);

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

  // AI-FIRST: when a STUDENT asks, let Codo try to answer from the course
  // material immediately. The teacher is STILL notified (model B) so a human
  // can review/add to the answer. Best-effort — never blocks the student's
  // message or the teacher escalation below.
  if (senderRole === "student") {
    try {
      await maybePostAiReply({
        lessonId: ctx.lessonId,
        courseId: ctx.courseId,
        parentId: created.id,
        question: text,
        hasInstructor: !!ctx.instructorUserId,
      });
    } catch (e) {
      logger.warn("lesson-chat", "ai_reply_failed", {
        lessonId: ctx.lessonId,
        error: (e as Error)?.message,
      });
    }
  }

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

/**
 * AI-first answer for a student's doubt. Searches the course's indexed study
 * material (RAG) and, if a confident, material-grounded answer exists, posts it
 * into the thread as a Codo (AI) message. Returns silently if nothing confident
 * is found (so the question stays open for the teacher).
 *
 * Mirrors the ai-mentor "RAG-first + NOT_IN_MATERIAL sentinel" pattern:
 *   - maxDistance 0.5 => only confident vector matches count.
 *   - the model must answer ONLY from the material, else reply NOT_IN_MATERIAL.
 * The resulting message is created server-side (bypassing the authenticated
 * post path), so it is pushed to all connected clients via the SSE stream.
 */
async function maybePostAiReply(opts: {
  lessonId: string;
  courseId: string;
  parentId: string;
  question: string;
  hasInstructor: boolean;
}): Promise<void> {
  if (!isGeminiConfigured()) return;

  const question = (opts.question || "").trim();
  if (!question) return;

  // Small helper to post a Codo (AI) message into the thread.
  const postCodo = async (text: string) => {
    await prisma.lessonChatMessage.create({
      data: {
        lessonId: opts.lessonId,
        courseId: opts.courseId,
        senderId: AI_SENDER_ID,
        senderRole: "ai",
        text,
        parentId: opts.parentId,
      },
    });
  };

  // Reassuring "I've asked your teacher" message when Codo can't answer, so the
  // student always gets a visible response (the teacher is notified separately).
  const escalateText = opts.hasInstructor
    ? "Hmm, I couldn't find this in your course material. \uD83E\uDD14 No worries \u2014 I've passed your question to your teacher, who will reply right here soon! \uD83D\uDC69\u200D\uD83C\uDFEB"
    : "Hmm, I couldn't find this in your course material. \uD83E\uDD14 No worries \u2014 your instructor will see your question and reply right here soon! \uD83D\uDC9C";

  // 1) Confidence gate: must find relevant course-material chunks.
  const matches = await searchChunks(question, {
    topK: 5,
    courseId: opts.courseId,
    maxDistance: 0.5,
  });
  if (matches.length === 0) {
    // Not covered → tell the student Codo is handing it to the teacher.
    await postCodo(escalateText);
    logger.info("lesson-chat", "ai_escalated_no_match", { lessonId: opts.lessonId });
    return;
  }

  const material = matches
    .map((m, i) => `[Source ${i + 1}: ${m.title}]\n${m.content}`)
    .join("\n\n---\n\n");

  // 2) Answer strictly from the material; sentinel if it isn't there.
  const prompt = `You are Codo, the friendly AI helper inside the CodingKida app for kids.
A student asked a doubt about this lesson. Answer using ONLY the study material below.
Rules:
1. Use ONLY facts from the study material. Do NOT add outside knowledge.
2. Explain simply and warmly, like talking to a curious child. Short sentences.
3. Reply in the SAME language the student used.
4. If the material does not actually contain the answer, reply EXACTLY: "NOT_IN_MATERIAL"

STUDY MATERIAL:
${material}

Student's question: ${question}`;

  const answer = await callGemini(prompt, { temperature: 0.4, maxOutputTokens: 1024 });

  if (!answer || answer.includes("NOT_IN_MATERIAL")) {
    // Material didn't actually contain the answer → escalate (visibly) to teacher.
    await postCodo(escalateText);
    logger.info("lesson-chat", "ai_escalated_not_in_material", { lessonId: opts.lessonId });
    return;
  }

  // 3) Post Codo's answer into the thread. A gentle note tells the student a
  // teacher may still add more (model B keeps the human in the loop).
  const aiText =
    answer.trim() +
    "\n\n— Codo (quick answer from your course material). Your teacher may add more. 💜";

  await postCodo(aiText);

  logger.success("lesson-chat", "ai_reply_posted", {
    lessonId: opts.lessonId,
    chunks: matches.length,
  });
}

/**
 * "Connect with our Expert" — a student explicitly asks for a human expert
 * (teacher/instructor) on this lesson, e.g. after Codo's answer wasn't enough.
 *
 * - Verifies the caller is an enrolled student (or instructor) of the course.
 * - Posts a small Codo confirmation into the thread so the student sees it was sent.
 * - Notifies the course instructor (same channel used elsewhere), referencing
 *   the student's most recent question in this lesson when available.
 *
 * Best-effort notifications; never throws to the caller on notify failure.
 */
export async function escalateToExpert(opts: {
  lessonId: string;
  requesterId: string;
  requesterName: string;
}): Promise<PostMessageResult> {
  const ctx = await resolveLessonContext(opts.lessonId);
  if (!ctx) return { ok: false, status: 404, message: "Lesson not found." };

  // Access: instructor of the course OR an enrolled student may escalate.
  const isInstructor = !!ctx.instructorUserId && ctx.instructorUserId === opts.requesterId;
  if (!isInstructor) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: opts.requesterId, courseId: ctx.courseId } },
      select: { id: true },
    });
    if (!enrollment) {
      return { ok: false, status: 403, message: "You don't have access to this lesson." };
    }
  }

  // Find the requester's most recent question in this lesson (for the preview).
  const lastQuestion = await prisma.lessonChatMessage.findFirst({
    where: { lessonId: ctx.lessonId, senderId: opts.requesterId, senderRole: "student" },
    orderBy: { createdAt: "desc" },
    select: { id: true, text: true },
  });

  // Post a visible Codo confirmation into the shared thread.
  const confirmText =
    `\uD83D\uDC4B ${opts.requesterName || "A student"} asked to connect with our expert. ` +
    `Our expert has been notified and will reply right here soon! \uD83D\uDC69\u200D\uD83C\uDFEB`;

  const created = await prisma.lessonChatMessage.create({
    data: {
      lessonId: ctx.lessonId,
      courseId: ctx.courseId,
      senderId: AI_SENDER_ID,
      senderRole: "ai",
      text: confirmText,
      parentId: lastQuestion?.id || null,
    },
  });

  // Notify the instructor/expert (non-fatal).
  try {
    if (ctx.instructorUserId) {
      const qText = (lastQuestion?.text || "a question").trim();
      const preview = qText.length > PREVIEW_MAX ? qText.slice(0, PREVIEW_MAX) + "…" : qText;
      await notifyLessonQuestion({
        instructorUserId: ctx.instructorUserId,
        lessonId: ctx.lessonId,
        courseId: ctx.courseId,
        messageId: created.id,
        studentName: opts.requesterName || "A student",
        lessonTitle: ctx.lessonTitle,
        courseTitle: ctx.courseTitle,
        preview,
      });
    }
  } catch {
    // Notification failure is non-fatal — the confirmation message is saved.
  }

  logger.success("lesson-chat", "expert_requested", {
    lessonId: ctx.lessonId,
    hasInstructor: !!ctx.instructorUserId,
  });

  return {
    ok: true,
    status: 201,
    data: {
      id: created.id,
      lessonId: created.lessonId,
      courseId: created.courseId,
      senderId: created.senderId,
      senderRole: created.senderRole,
      senderName: AI_SENDER_NAME,
      text: created.text,
      parentId: created.parentId,
      createdAt: created.createdAt.toISOString(),
      isMine: false,
    },
  };
}
