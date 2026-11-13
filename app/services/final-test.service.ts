/**
 * Final course test + certificate — business logic used by the API routes.
 *
 * Rules:
 *  - Available only for courses with hasCert and a generated FinalTest.
 *  - Student must be ENROLLED and have COMPLETED every lesson.
 *  - 60-minute limit (server time), +2 min grace; an attempt left open past
 *    that is finalised as submitted with no answers.
 *  - After a FAILED attempt: retry after 24 h (unless the course is already
 *    passed — then practice attempts are allowed any time).
 *  - Pass ≥ passPercent (default 60%) → the student confirms the name, then a
 *    Certificate is issued once per user per course and emailed as a PDF.
 *  - Correct answers are revealed in the review only when the attempt passed
 *    (so a failed student can't memorise the set before the retry).
 */
import { prisma } from "@/app/lib/prisma";
import { sendEmail } from "@/app/lib/mail";
import { logger } from "@/app/lib/logger";
import { buildCertificatePdf } from "@/app/lib/certificate-pdf";
import {
  FINAL_TEST_COOLDOWN_HOURS, FINAL_TEST_GRACE_SEC,
  asAnswers, asIdArray, generateCertificateCode, getCourseCompletion, shuffle, validateCertificateName,
} from "@/app/lib/final-test";

export class FinalTestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const ms = (min: number) => min * 60 * 1000;

function toOptions(v: unknown): string[] {
  return Array.isArray(v) ? v.map((o) => String(o)) : [];
}

async function suggestedName(userId: string): Promise<string> {
  const [student, user] = await Promise.all([
    prisma.student.findUnique({ where: { userId }, select: { studentName: true, name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  return (student?.studentName || student?.name || user?.name || "").trim();
}

/** Grade an attempt (idempotent: only the first finalisation wins). */
async function finalizeAttempt(attemptId: string, answers: Record<string, number>, passPercent: number) {
  const attempt = await prisma.finalTestAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw new FinalTestError(404, "Attempt not found.");
  const ids = asIdArray(attempt.quizIds);
  const quizzes = await prisma.quiz.findMany({ where: { id: { in: ids } }, select: { id: true, answer: true } });
  const answerKey = new Map(quizzes.map((q) => [q.id, q.answer]));
  let score = 0;
  for (const id of ids) {
    if (answers[id] !== undefined && answerKey.get(id) === answers[id]) score++;
  }
  const total = ids.length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percent >= passPercent;
  // updateMany with submittedAt=null guards against a double submit.
  const res = await prisma.finalTestAttempt.updateMany({
    where: { id: attemptId, submittedAt: null },
    data: { answers, score, total, percent, passed, submittedAt: new Date() },
  });
  return { updated: res.count > 0, score, total, percent, passed };
}

/** Finalise this user's open attempts that ran past the time limit. */
async function finalizeExpired(userId: string, courseId: string, timeLimitMin: number, passPercent: number) {
  const cutoff = new Date(Date.now() - ms(timeLimitMin) - FINAL_TEST_GRACE_SEC * 1000);
  const stale = await prisma.finalTestAttempt.findMany({
    where: { userId, courseId, submittedAt: null, startedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const a of stale) await finalizeAttempt(a.id, {}, passPercent);
}

async function loadContext(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, hasCert: true } });
  if (!course) throw new FinalTestError(404, "Course not found.");
  const test = await prisma.finalTest.findUnique({ where: { courseId } });
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  return { course, test, enrolled: !!enrollment };
}

// ── Status (drives the Final Test card) ─────────────────────────────────────
export async function getFinalTestStatus(userId: string, courseId: string) {
  const { course, test, enrolled } = await loadContext(userId, courseId);
  if (!test || !course.hasCert) return { available: false as const };

  await finalizeExpired(userId, courseId, test.timeLimitMin, test.passPercent);
  const [completion, attempts, certificate] = await Promise.all([
    getCourseCompletion(prisma, userId, courseId),
    prisma.finalTestAttempt.findMany({
      where: { userId, courseId },
      orderBy: { startedAt: "desc" },
      select: { id: true, percent: true, passed: true, startedAt: true, submittedAt: true },
    }),
    prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } }),
  ]);

  const submitted = attempts.filter((a) => a.submittedAt);
  const open = attempts.find((a) => !a.submittedAt) || null;
  const everPassed = submitted.some((a) => a.passed);
  const best = submitted.reduce((m, a) => Math.max(m, a.percent ?? 0), 0);
  const lastFailed = submitted.find((a) => !a.passed) && !everPassed ? submitted[0] : null;
  const nextAttemptAt = lastFailed?.submittedAt && !lastFailed.passed
    ? new Date(lastFailed.submittedAt.getTime() + FINAL_TEST_COOLDOWN_HOURS * 3600 * 1000)
    : null;
  const coolingDown = !!nextAttemptAt && nextAttemptAt.getTime() > Date.now();
  const passedAttempt = submitted.find((a) => a.passed) || null;

  return {
    available: true as const,
    courseTitle: course.title,
    totalQuestions: asIdArray(test.quizIds).length,
    passPercent: test.passPercent,
    timeLimitMin: test.timeLimitMin,
    enrolled,
    ...completion,
    unlocked: enrolled && completion.allCompleted,
    attemptsCount: submitted.length,
    bestPercent: submitted.length ? best : null,
    passed: everPassed,
    nextAttemptAt: coolingDown ? nextAttemptAt!.toISOString() : null,
    inProgress: open
      ? { attemptId: open.id, endsAt: new Date(open.startedAt.getTime() + ms(test.timeLimitMin)).toISOString() }
      : null,
    certificate: certificate
      ? { code: certificate.code, studentName: certificate.studentName, percent: certificate.percent, issuedAt: certificate.issuedAt.toISOString() }
      : null,
    // Passed but name not confirmed yet → the app asks for the certificate name.
    pendingCertificate: !certificate && passedAttempt
      ? { attemptId: passedAttempt.id, suggestedName: await suggestedName(userId) }
      : null,
  };
}

// ── Start (or resume) an attempt ────────────────────────────────────────────
export async function startFinalTest(userId: string, courseId: string) {
  const { course, test, enrolled } = await loadContext(userId, courseId);
  if (!test || !course.hasCert) throw new FinalTestError(404, "The final test is not available for this course yet.");
  if (!enrolled) throw new FinalTestError(403, "You are not enrolled in this course.");
  const completion = await getCourseCompletion(prisma, userId, courseId);
  if (!completion.allCompleted) {
    throw new FinalTestError(403, `Complete all lessons to unlock the final test (${completion.completedLessons}/${completion.totalLessons} done).`);
  }
  await finalizeExpired(userId, courseId, test.timeLimitMin, test.passPercent);

  let attempt = await prisma.finalTestAttempt.findFirst({
    where: { userId, courseId, submittedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (!attempt) {
    const submitted = await prisma.finalTestAttempt.findMany({
      where: { userId, courseId, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      select: { passed: true, submittedAt: true },
    });
    const everPassed = submitted.some((a) => a.passed);
    const last = submitted[0];
    if (!everPassed && last && !last.passed && last.submittedAt) {
      const next = last.submittedAt.getTime() + FINAL_TEST_COOLDOWN_HOURS * 3600 * 1000;
      if (next > Date.now()) {
        throw new FinalTestError(429, `You can retake the test after ${new Date(next).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}.`);
      }
    }
    // Only quizzes that still exist; fresh order every attempt.
    const ids = asIdArray(test.quizIds);
    const existing = await prisma.quiz.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const live = new Set(existing.map((q) => q.id));
    const order = shuffle(ids.filter((id) => live.has(id)));
    if (order.length === 0) throw new FinalTestError(409, "This test has no questions. Please contact support.");
    attempt = await prisma.finalTestAttempt.create({
      data: { userId, courseId, quizIds: order, total: order.length },
    });
  }

  const ids = asIdArray(attempt.quizIds);
  const rows = await prisma.quiz.findMany({ where: { id: { in: ids } }, select: { id: true, question: true, options: true } });
  const byId = new Map(rows.map((q) => [q.id, q]));
  // NOTE: the correct answer is deliberately NOT included.
  const questions = ids
    .map((id) => byId.get(id))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map((q) => ({ id: q.id, question: q.question, options: toOptions(q.options) }));

  return {
    attemptId: attempt.id,
    courseTitle: course.title,
    questions,
    total: questions.length,
    passPercent: test.passPercent,
    timeLimitMin: test.timeLimitMin,
    startedAt: attempt.startedAt.toISOString(),
    endsAt: new Date(attempt.startedAt.getTime() + ms(test.timeLimitMin)).toISOString(),
    serverNow: new Date().toISOString(),
  };
}

// ── Submit + grade ──────────────────────────────────────────────────────────
export async function submitFinalTest(userId: string, attemptId: string, rawAnswers: unknown) {
  const attempt = await prisma.finalTestAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) throw new FinalTestError(404, "Attempt not found.");
  const test = await prisma.finalTest.findUnique({ where: { courseId: attempt.courseId } });
  if (!test) throw new FinalTestError(404, "The final test is not available.");
  if (attempt.submittedAt) throw new FinalTestError(409, "This attempt was already submitted.");

  const deadline = attempt.startedAt.getTime() + ms(test.timeLimitMin) + FINAL_TEST_GRACE_SEC * 1000;
  const late = Date.now() > deadline;
  const ids = new Set(asIdArray(attempt.quizIds));
  const answers = Object.fromEntries(Object.entries(asAnswers(rawAnswers)).filter(([k]) => ids.has(k)));

  // Past the deadline → answers are not accepted (graded as unanswered).
  const result = await finalizeAttempt(attemptId, late ? {} : answers, test.passPercent);
  if (!result.updated) throw new FinalTestError(409, "This attempt was already submitted.");

  const quizzes = await prisma.quiz.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, question: true, options: true, answer: true, explanation: true },
  });
  const byId = new Map(quizzes.map((q) => [q.id, q]));
  const given = late ? {} : answers;
  const review = asIdArray(attempt.quizIds)
    .map((id) => byId.get(id))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map((q) => {
      const selected = given[q.id] ?? null;
      const correct = selected !== null && selected === q.answer;
      return {
        quizId: q.id,
        question: q.question,
        options: toOptions(q.options),
        selected,
        correct,
        // Reveal the right answer only when the attempt passed.
        answer: result.passed ? q.answer : null,
        explanation: result.passed ? q.explanation ?? null : null,
      };
    });

  const certificate = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId: attempt.courseId } },
  });

  logger.info("final-test", "submitted", { userId, courseId: attempt.courseId, percent: result.percent, passed: result.passed, late });

  return {
    score: result.score,
    total: result.total,
    percent: result.percent,
    passed: result.passed,
    passPercent: test.passPercent,
    late,
    review,
    certificate: certificate ? { code: certificate.code, issuedAt: certificate.issuedAt.toISOString() } : null,
    needsCertificate: result.passed && !certificate,
    suggestedName: result.passed && !certificate ? await suggestedName(userId) : null,
    nextAttemptAt: !result.passed
      ? new Date(Date.now() + FINAL_TEST_COOLDOWN_HOURS * 3600 * 1000).toISOString()
      : null,
  };
}

// ── Issue certificate (after the student confirms the name) ────────────────
export async function issueCertificate(userId: string, attemptId: string, rawName: unknown) {
  const attempt = await prisma.finalTestAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) throw new FinalTestError(404, "Attempt not found.");
  if (!attempt.passed || !attempt.submittedAt) throw new FinalTestError(403, "Pass the final test to get a certificate.");

  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId: attempt.courseId } },
  });
  if (existing) return { certificate: existing, created: false };

  const name = validateCertificateName(rawName);
  if (!name) {
    throw new FinalTestError(400, "Please enter a valid name (English letters, spaces, . ' - only; 2–60 characters).");
  }
  const course = await prisma.course.findUnique({ where: { id: attempt.courseId }, select: { title: true } });
  if (!course) throw new FinalTestError(404, "Course not found.");

  let certificate = null;
  for (let i = 0; i < 5 && !certificate; i++) {
    try {
      certificate = await prisma.certificate.create({
        data: {
          code: generateCertificateCode(),
          userId,
          courseId: attempt.courseId,
          attemptId,
          studentName: name,
          courseTitle: course.title,
          percent: attempt.percent ?? 0,
        },
      });
    } catch (e) {
      // P2002 = unique clash: either a code collision (retry) or a concurrent
      // issue for the same user+course (return that one).
      const dup = await prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId: attempt.courseId } } });
      if (dup) return { certificate: dup, created: false };
      if (i === 4) throw e;
    }
  }

  // Email the PDF (best-effort; sendEmail never throws).
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email && certificate) {
      const pdf = await buildCertificatePdf({
        code: certificate.code, studentName: certificate.studentName, courseTitle: certificate.courseTitle,
        percent: certificate.percent, issuedAt: certificate.issuedAt,
      });
      await sendEmail(
        user.email,
        `🎓 Your CodingKida certificate — ${certificate.courseTitle}`,
        certificateEmailHtml(certificate.studentName, certificate.courseTitle, certificate.percent, certificate.code),
        [{ filename: `CodingKida-Certificate-${certificate.code}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
      );
    }
  } catch (err) {
    logger.error("final-test", "certificate_email_failed", { userId, error: err instanceof Error ? err.message : "unknown" });
  }

  logger.success("final-test", "certificate_issued", { userId, courseId: attempt.courseId, code: certificate!.code });
  return { certificate: certificate!, created: true };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function certificateEmailHtml(name: string, course: string, percent: number, code: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0f0f1a;color:#e2e8f0;padding:32px;border-radius:16px">
  <h2 style="color:#a78bfa;margin:0 0 12px">🎓 Congratulations, ${esc(name)}!</h2>
  <p style="line-height:1.6">You passed the final test of <b>${esc(course)}</b> with <b>${percent}%</b>.</p>
  <div style="background:#16213e;border:2px solid #6c47ff;border-radius:12px;padding:16px;margin:18px 0">
    <div style="color:#94a3b8;font-size:13px">Certificate ID</div>
    <div style="font-size:20px;font-weight:bold;letter-spacing:1px">${esc(code)}</div>
  </div>
  <p style="line-height:1.6">Your certificate is attached as a PDF. You can also view it any time in the CodingKida app (course page → Final Test).</p>
  <p style="color:#64748b;font-size:13px;margin-top:24px">— CodingKida Team</p>
</div>`;
}

// ── Certificates ────────────────────────────────────────────────────────────
export async function listMyCertificates(userId: string) {
  const rows = await prisma.certificate.findMany({ where: { userId }, orderBy: { issuedAt: "desc" } });
  return rows.map((c) => ({
    code: c.code, courseId: c.courseId, courseTitle: c.courseTitle, studentName: c.studentName,
    percent: c.percent, issuedAt: c.issuedAt.toISOString(),
  }));
}

export async function getCertificatePdfForOwner(userId: string, code: string, isAdmin = false) {
  const c = await prisma.certificate.findUnique({ where: { code } });
  if (!c || (c.userId !== userId && !isAdmin)) throw new FinalTestError(404, "Certificate not found.");
  const pdf = await buildCertificatePdf({
    code: c.code, studentName: c.studentName, courseTitle: c.courseTitle, percent: c.percent, issuedAt: c.issuedAt,
  });
  return { pdf, filename: `CodingKida-Certificate-${c.code}.pdf` };
}

export async function verifyCertificate(code: string) {
  const c = await prisma.certificate.findUnique({ where: { code } });
  if (!c) return { valid: false as const };
  return {
    valid: true as const,
    code: c.code, studentName: c.studentName, courseTitle: c.courseTitle,
    percent: c.percent, issuedAt: c.issuedAt.toISOString(),
  };
}
