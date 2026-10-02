import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { callGemini, isGeminiConfigured } from "@/app/lib/gemini";
import { searchChunks } from "@/app/lib/rag";
import { logger } from "@/app/lib/logger";

/**
 * POST /api/lesson-help
 * Kid-friendly "Help" for a quiz question or an exercise.
 *
 * Body: {
 *   kind: "quiz" | "exercise",
 *   quizId?: string,       // required when kind === "quiz"
 *   exerciseId?: string,   // required when kind === "exercise"
 *   stage: "hint" | "answer",
 * }
 *
 * Pedagogy (best for kids):
 *   - stage "hint"   -> a gentle nudge, NEVER the answer. Encourages thinking.
 *   - stage "answer" -> the correct answer (from stored ground truth) PLUS a
 *                       simple "why", grounded in the lesson's study material
 *                       (RAG). Falls back to the stored explanation / general
 *                       Gemini if nothing relevant is indexed.
 *
 * The correct answer itself always comes from the database (quiz.answer /
 * exercise solution), so it is never an AI guess. The AI only writes the
 * kid-friendly reasoning around it.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    if (!isGeminiConfigured()) {
      return apiError(503, "AI service not configured.");
    }

    const body = await req.json();
    const kind: string = body?.kind;
    const stage: string = body?.stage === "answer" ? "answer" : "hint";

    if (kind !== "quiz" && kind !== "exercise") {
      return apiError(400, "kind must be 'quiz' or 'exercise'.");
    }

    // ---- Load the item + its lesson/course for RAG scoping ----------------
    let questionText = "";
    let correctAnswerText = ""; // ground-truth answer (never AI-guessed)
    let storedExplanation = "";
    let courseId: string | null = null;
    let topicLabel = "";

    if (kind === "quiz") {
      if (!body?.quizId) return apiError(400, "quizId is required.");
      const quiz = await prisma.quiz.findUnique({
        where: { id: body.quizId },
        include: { lesson: { select: { title: true, module: { select: { courseId: true } } } } },
      });
      if (!quiz) return apiError(404, "Quiz not found.");

      const options = Array.isArray(quiz.options) ? (quiz.options as unknown[]) : [];
      const letters = ["A", "B", "C", "D", "E", "F"];
      const optionsText = options
        .map((o, i) => `${letters[i]}. ${String(o)}`)
        .join("\n");
      questionText = `${quiz.question}\n${optionsText}`;
      const correctIdx = Number(quiz.answer);
      correctAnswerText =
        options[correctIdx] !== undefined
          ? `${letters[correctIdx]}. ${String(options[correctIdx])}`
          : `Option ${correctIdx + 1}`;
      storedExplanation = quiz.explanation || "";
      courseId = quiz.lesson?.module?.courseId ?? null;
      topicLabel = quiz.lesson?.title || "this lesson";
    } else {
      if (!body?.exerciseId) return apiError(400, "exerciseId is required.");
      const ex = await prisma.exercise.findUnique({
        where: { id: body.exerciseId },
        include: { lesson: { select: { title: true, module: { select: { courseId: true } } } } },
      });
      if (!ex) return apiError(404, "Exercise not found.");

      questionText = `${ex.title}\n${ex.description}`;
      // Prefer admin best solution, then stored solution.
      const best = ex.bestSolution ? JSON.stringify(ex.bestSolution) : "";
      correctAnswerText = ex.solution || best || "";
      storedExplanation = ex.explanation || "";
      courseId = ex.lesson?.module?.courseId ?? null;
      topicLabel = ex.lesson?.title || "this lesson";
    }

    // ---- Pull supporting study material via RAG (best-effort) -------------
    let material = "";
    try {
      const matches = await searchChunks(questionText, {
        topK: 4,
        courseId,
        maxDistance: 0.6, // a bit looser than chat — help should try harder
      });
      if (matches.length > 0) {
        material = matches
          .map((m, i) => `[Source ${i + 1}: ${m.title}]\n${m.content}`)
          .join("\n\n---\n\n");
      }
    } catch (e) {
      logger.warn("lesson-help", "rag_failed", { error: (e as Error)?.message });
    }

    // ---- Build the stage-appropriate prompt -------------------------------
    const materialBlock = material
      ? `STUDY MATERIAL (use this to explain simply):\n${material}\n`
      : storedExplanation
      ? `TEACHER NOTE (use this to explain simply):\n${storedExplanation}\n`
      : "";

    let prompt = "";

    if (stage === "hint") {
      // A nudge only — must NOT reveal the answer.
      prompt = `You are Coco, a warm, encouraging AI buddy for kids on the CodingKida learning app.
The child is working on a ${kind} about "${topicLabel}" and tapped "Help".

Give ONE small, friendly HINT that nudges them toward figuring it out THEMSELVES.
Rules:
- Do NOT reveal the correct answer or which option is right.
- Keep it to 1-2 short, simple sentences a child understands.
- Be positive and playful (one emoji is fine).
- Base the hint on the material if provided.
${materialBlock}
QUESTION:
${questionText}

Your hint:`;
    } else {
      // Full answer: ground truth + kid-friendly reasons.
      prompt = `You are Coco, a warm, encouraging AI buddy for kids on the CodingKida learning app.
The child is working on a ${kind} about "${topicLabel}" and asked to see the answer.

The CORRECT answer (ground truth — trust this completely) is:
${correctAnswerText || "(not available)"}

Write a short, friendly explanation for a child:
1. Clearly state the correct answer.
2. Explain WHY it is correct, in simple words, using ONLY the material/teacher note below when available. Do not invent facts.
3. Keep it short, warm, and encouraging (a couple of short sentences; one emoji is fine).
4. Reply in the SAME language the child used in the question.
${materialBlock}
QUESTION:
${questionText}

Your explanation:`;
    }

    const answer = await callGemini(prompt, {
      temperature: 0.5,
      maxOutputTokens: 1024,
    });

    if (!answer) {
      // Last-resort fallback so the child is never left stuck.
      if (stage === "answer" && (correctAnswerText || storedExplanation)) {
        return apiSuccess({
          stage,
          help:
            `The correct answer is: ${correctAnswerText}` +
            (storedExplanation ? `\n\nWhy: ${storedExplanation}` : ""),
          source: "stored",
        });
      }
      return apiError(429, "Coco is a little busy. Please try again in a moment.");
    }

    logger.success("lesson-help", "help_generated", {
      userId: user!.userId,
      kind,
      stage,
      usedMaterial: !!material,
    });

    return apiSuccess({
      stage,
      help: answer,
      source: material ? "study_material" : storedExplanation ? "teacher_note" : "ai",
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
