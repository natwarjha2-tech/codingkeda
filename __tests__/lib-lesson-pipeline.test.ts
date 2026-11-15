/**
 * Unit tests — lesson pipeline orchestrator (app/lib/lesson-pipeline.ts) [Phase 8]
 *   • triggerLessonPipeline — no-op on empty id
 *   • runs video + quiz + exercise, sends ONE success notification
 *   • all-skipped run → NO notification (noise suppression)
 *   • any failure → HIGH-priority failure notification
 *   • dedup: a duplicate enqueue for the same lesson+video collapses to one run
 *
 * FULLY MOCKED — video-processor, the content generators, prisma and the
 * notification creator are mocked. The pipeline is fire-and-forget, so each
 * test awaits the internal queue drain via a short tick flush. No real DB /
 * AWS / Gemini is touched.
 */

jest.mock("@/app/lib/video-processor", () => ({
  processVideoById: jest.fn(),
}));
jest.mock("@/app/lib/lesson-content-generator", () => ({
  generateLessonQuiz: jest.fn(),
  generateLessonExercise: jest.fn(),
}));
jest.mock("@/app/lib/notification", () => ({
  createNotification: jest.fn().mockResolvedValue({ id: "n1" }),
}));
jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    media: { findUnique: jest.fn() },
    lesson: { findUnique: jest.fn() },
  },
}));
jest.mock("@/app/lib/logger", () => ({
  logger: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { triggerLessonPipeline } from "@/app/lib/lesson-pipeline";
import { processVideoById } from "@/app/lib/video-processor";
import { generateLessonQuiz, generateLessonExercise } from "@/app/lib/lesson-content-generator";
import { createNotification } from "@/app/lib/notification";
import { prisma } from "@/app/lib/prisma";

const mVideo = processVideoById as jest.MockedFunction<typeof processVideoById>;
const mQuiz = generateLessonQuiz as jest.MockedFunction<typeof generateLessonQuiz>;
const mExercise = generateLessonExercise as jest.MockedFunction<typeof generateLessonExercise>;
const mNotify = createNotification as jest.MockedFunction<typeof createNotification>;
const mLessonFind = prisma.lesson.findUnique as jest.MockedFunction<typeof prisma.lesson.findUnique>;

/** Let the fire-and-forget queue drain (several async hops: runJob → awaits). */
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

beforeEach(() => {
  mNotify.mockResolvedValue({ id: "n1" } as never);
  // lesson title + admin resolution
  mLessonFind.mockResolvedValue({
    title: "Loops",
    module: { course: { createdBy: "admin-1" } },
  } as never);
});

describe("triggerLessonPipeline", () => {
  it("is a no-op for an empty lessonId", async () => {
    triggerLessonPipeline("");
    await flush();
    expect(mQuiz).not.toHaveBeenCalled();
    expect(mVideo).not.toHaveBeenCalled();
  });

  it("runs quiz + exercise (no video) and sends one success notification", async () => {
    mQuiz.mockResolvedValue({ ok: true, count: 5 } as never);
    mExercise.mockResolvedValue({ ok: true, count: 5 } as never);

    triggerLessonPipeline("l1");
    await flush();

    expect(mQuiz).toHaveBeenCalledWith("l1");
    expect(mExercise).toHaveBeenCalledWith("l1");
    expect(mVideo).not.toHaveBeenCalled();
    expect(mNotify).toHaveBeenCalledTimes(1);
    const arg = mNotify.mock.calls[0][0] as { title: string; priority: string };
    expect(arg.title).toContain("ready");
  });

  it("includes the video step when a videoMediaId is provided", async () => {
    mVideo.mockResolvedValue({ ok: true } as never);
    mQuiz.mockResolvedValue({ ok: true, count: 3 } as never);
    mExercise.mockResolvedValue({ ok: true, skipped: true } as never);

    triggerLessonPipeline("l2", "media-1", { forceVideo: true });
    await flush();

    expect(mVideo).toHaveBeenCalledWith("media-1", { force: true });
    expect(mNotify).toHaveBeenCalledTimes(1);
  });

  it("sends NO notification when everything was skipped (no real work)", async () => {
    mQuiz.mockResolvedValue({ ok: true, skipped: true } as never);
    mExercise.mockResolvedValue({ ok: true, skipped: true } as never);

    triggerLessonPipeline("l3");
    await flush();

    expect(mNotify).not.toHaveBeenCalled();
  });

  it("sends a HIGH-priority failure notification when a part fails", async () => {
    mQuiz.mockResolvedValue({ ok: false, error: "gemini down" } as never);
    mExercise.mockResolvedValue({ ok: true, count: 2 } as never);

    triggerLessonPipeline("l4");
    await flush();

    expect(mNotify).toHaveBeenCalledTimes(1);
    const arg = mNotify.mock.calls[0][0] as { title: string; priority: string; body: string };
    expect(arg.priority).toBe("HIGH");
    expect(arg.body).toContain("gemini down");
  });

  it("deduplicates a queued double-fire for the same lesson+video into one run", async () => {
    // Hold the FIRST job open (quiz never resolves) so the pipeline stays
    // "running". While it's running, two more identical triggers arrive — they
    // land in the queue, and the dedup must collapse the pair into ONE queued
    // job. We then release the first job and drain; only ONE extra run happens.
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((r) => { releaseFirst = () => r(); });

    mVideo.mockResolvedValue({ ok: true } as never);
    mExercise.mockResolvedValue({ ok: true, count: 1 } as never);
    mQuiz
      .mockImplementationOnce(async () => { await firstGate; return { ok: true, count: 1 } as never; }) // blocks job #1 (a prior lesson)
      .mockResolvedValue({ ok: true, count: 1 } as never);

    // Job #1 (different lesson) starts running and blocks on firstGate.
    triggerLessonPipeline("prior-lesson");
    await Promise.resolve();

    // Two identical triggers for l5 arrive while #1 is still running → queued +
    // deduped into a single job.
    triggerLessonPipeline("l5", "media-5");
    triggerLessonPipeline("l5", "media-5");

    // Release #1 and let the queue drain.
    releaseFirst();
    await flush();

    // Quiz ran for job#1 + ONE l5 job = 2 total (not 3) — the dedup collapsed
    // the duplicate l5 enqueue.
    expect(mQuiz).toHaveBeenCalledTimes(2);
  });
});
