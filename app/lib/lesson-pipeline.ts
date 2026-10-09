/**
 * Lesson content pipeline.
 *
 * One fire-and-forget entry point — triggerLessonPipeline — that runs the three
 * heavy post-save jobs for a lesson and sends ONE combined notification:
 *   1. video quality processing (if a video media is attached)
 *   2. quiz generation (from the module's quiz/ppt/notes PDF)
 *   3. exercise generation (from the module's worksheet/notes PDF)
 *
 * It AWAITS all three (via the non-notifying video variant + the per-lesson
 * generators) and then notifies the admin once:
 *   - SUCCESS when every part is ok (treating "skipped" as success), noting
 *     which parts were skipped (e.g. no worksheet/quiz PDF).
 *   - FAILURE (HIGH priority) when any part failed, naming each failed part and
 *     its reason.
 *
 * An in-process queue serializes runs so concurrent saves never run multiple
 * heavy Gemini/ffmpeg jobs at once (mirrors video-processor.ts). The video step
 * additionally shares video-processor's own encode guard.
 */
import { prisma } from "@/app/lib/prisma";
import { processVideoById } from "@/app/lib/video-processor";
import { generateLessonQuiz, generateLessonExercise } from "@/app/lib/lesson-content-generator";
import { createNotification } from "@/app/lib/notification";
import { NOTIF_TYPES, NOTIF_CATEGORIES, NOTIF_PRIORITIES } from "@/app/lib/notification-types";
import { logger } from "@/app/lib/logger";

type PartResult = { ok: boolean; skipped?: boolean; count?: number; error?: string };

interface Job {
  lessonId: string;
  videoMediaId?: string;
  // When the lesson's video was REPLACED, force a fresh re-encode (wipe any
  // partial/old qualities first) rather than reusing whatever is in S3.
  forceVideo?: boolean;
}

// Serialize pipeline runs so two saves don't fire concurrent heavy jobs.
let running = false;
const queue: Job[] = [];

async function resolveAdminUserId(lessonId: string, videoMediaId?: string): Promise<string | null> {
  // Prefer the admin who uploaded the video media.
  if (videoMediaId) {
    const media = await prisma.media.findUnique({
      where: { id: videoMediaId },
      select: { uploadedBy: true },
    });
    if (media?.uploadedBy) return media.uploadedBy;
  }
  // Otherwise resolve the admin from the lesson's course createdBy.
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { course: { select: { createdBy: true } } } } },
  });
  return lesson?.module?.course?.createdBy ?? null;
}

async function getLessonTitle(lessonId: string): Promise<string> {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { title: true } });
  return lesson?.title || "Lesson";
}

// Describe one part for the SUCCESS body. Shows the FULL status of every part
// that ran — including skipped — so the admin sees the complete picture, e.g.
// "Video processed, Quiz skipped (already exists), Exercise skipped (already
// exists)". Only a part that didn't run at all (no video attached) is omitted.
function describeSuccessPart(label: string, r: PartResult | null): string | null {
  if (!r) return null; // part not run (e.g. no video attached)
  if (r.skipped) return `${label} skipped (already exists)`;
  if (label === "Video") return "Video processed";
  return `${label} generated${r.count !== undefined ? ` (${r.count})` : ""}`;
}

async function runJob(job: Job): Promise<void> {
  const { lessonId, videoMediaId, forceVideo } = job;
  const lessonTitle = await getLessonTitle(lessonId);

  // Run all three IN PARALLEL. They use different resources — video is CPU-bound
  // (ffmpeg, and it serializes itself via video-processor's own encode guard),
  // while quiz + exercise are I/O-bound (waiting on the Gemini API) — so running
  // them concurrently maximizes throughput without contending for the same
  // resource. Each generator already catches its own errors and resolves to a
  // PartResult, so Promise.all never rejects here.
  const videoP: Promise<PartResult | null> = videoMediaId
    ? processVideoById(videoMediaId, { force: forceVideo === true })
    : Promise.resolve(null);
  const [video, quiz, exercise]: [PartResult | null, PartResult, PartResult] = await Promise.all([
    videoP,
    generateLessonQuiz(lessonId),
    generateLessonExercise(lessonId),
  ]);

  const parts: { label: string; r: PartResult | null }[] = [
    { label: "Video", r: video },
    { label: "Quiz", r: quiz },
    { label: "Exercise", r: exercise },
  ];
  const failed = parts.filter((p) => p.r && !p.r.ok);
  const allOk = failed.length === 0;

  // Did any part actually DO something this run? A part "did work" when it ran
  // and was neither skipped (content already existed / no source PDF) nor absent
  // (no video attached). A re-save where quiz+exercise already exist and the
  // video is unchanged produces all-skipped → nothing happened.
  const didWork = parts.some((p) => p.r && p.r.ok && !p.r.skipped);

  logger.info("lesson-pipeline", allOk ? "settled_ok" : "settled_with_failures", {
    lessonId,
    didWork,
    video: video ? (video.ok ? (video.skipped ? "skipped" : "ok") : "failed") : "none",
    quiz: quiz.ok ? (quiz.skipped ? "skipped" : "ok") : "failed",
    exercise: exercise.ok ? (exercise.skipped ? "skipped" : "ok") : "failed",
  });

  // Suppress the notification when the run succeeded but did NO real work — i.e.
  // everything was skipped/none (a re-save of a lesson whose content already
  // exists). Only notify on genuine success (something generated/processed) or
  // on any failure. This stops the "video skipped, quiz skipped, exercise
  // skipped" noise notifications.
  if (allOk && !didWork) {
    logger.info("lesson-pipeline", "no_notification_all_skipped", { lessonId });
    return;
  }

  const userId = await resolveAdminUserId(lessonId, videoMediaId);
  if (!userId) return; // no resolvable admin → skip notification silently

  if (allOk) {
    const summary = parts
      .map((p) => describeSuccessPart(p.label, p.r))
      .filter(Boolean)
      .join(", ");
    await createNotification({
      userId,
      type: NOTIF_TYPES.LESSON_CONTENT_READY,
      category: NOTIF_CATEGORIES.SYSTEM,
      priority: NOTIF_PRIORITIES.NORMAL,
      title: "Lesson content ready ✅",
      body: `"${lessonTitle}" is ready: ${summary}.`,
      metadata: {
        lessonId,
        video: video ? (video.skipped ? "skipped" : "ok") : "none",
        quizCount: quiz.count ?? 0,
        exerciseCount: exercise.count ?? 0,
      },
      idempotencyKey: `lesson_content_ok_${lessonId}_${Date.now()}`,
    }).catch(() => {});
  } else {
    // Build a per-part sentence: failures with reasons, plus context on the rest.
    const sentences = parts
      .filter((p) => p.r) // skip parts that didn't run (e.g. no video)
      .map((p) => {
        const r = p.r!;
        if (!r.ok) return `${p.label} failed: ${r.error || "unknown error"}.`;
        if (r.skipped) return `${p.label} skipped (already exists or no source).`;
        if (p.label === "Video") return "Video processed.";
        return `${p.label} generated${r.count !== undefined ? ` (${r.count})` : ""}.`;
      });
    await createNotification({
      userId,
      type: NOTIF_TYPES.LESSON_CONTENT_FAILED,
      category: NOTIF_CATEGORIES.SYSTEM,
      priority: NOTIF_PRIORITIES.HIGH,
      title: "Lesson content issue ❌",
      body: `"${lessonTitle}": ${sentences.join(" ")} You can re-save the lesson to retry.`,
      metadata: {
        lessonId,
        failedParts: failed.map((p) => p.label.toLowerCase()),
      },
      idempotencyKey: `lesson_content_fail_${lessonId}_${Date.now()}`,
    }).catch(() => {});
  }
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift()!;
      try {
        await runJob(job);
      } catch (err) {
        logger.error("lesson-pipeline", "job_error", { lessonId: job.lessonId, error: (err as Error)?.message });
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Kick off the full lesson content pipeline (video + quiz + exercise) for ONE
 * lesson. Fire-and-forget: returns immediately so the admin's Save request is
 * never blocked. Concurrent calls are queued and run sequentially. Never throws.
 *
 * Pass `opts.forceVideo` when the lesson's video was REPLACED, so the video step
 * wipes any partial/old qualities and re-encodes the new file from scratch.
 */
export function triggerLessonPipeline(
  lessonId: string,
  videoMediaId?: string,
  opts: { forceVideo?: boolean } = {},
): void {
  if (!lessonId) return;
  const forceVideo = opts.forceVideo === true;

  // Deduplicate: the admin UI can fire the save/update-video endpoint more than
  // once for a single Save (observed twice ~30s apart). Each enqueue = one
  // pipeline run = one notification, which spams the admin. If a PENDING job for
  // the same lesson+video is already queued, merge into it instead of adding a
  // duplicate (keep forceVideo if either caller wanted it). A job that's already
  // mid-run isn't in the queue, so a genuine later re-save still runs — but the
  // rapid double-fire of a single Save collapses to one.
  const dup = queue.find((j) => j.lessonId === lessonId && j.videoMediaId === videoMediaId);
  if (dup) {
    if (forceVideo) dup.forceVideo = true;
    return;
  }
  queue.push({ lessonId, videoMediaId, forceVideo });
  void drain();
}
