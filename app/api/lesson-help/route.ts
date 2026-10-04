import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { callGemini, callGeminiStream, isGeminiConfigured } from "@/app/lib/gemini";
import { searchChunks, resolveSources } from "@/app/lib/rag";
import { synthesizeSpeech } from "@/app/api/tts/route";
import { logger } from "@/app/lib/logger";

type HelpSource = { name: string; fileUrl: string | null; snippet: string };

/**
 * Build a Response that serves an already-cached help entry.
 * Streaming clients get the text in one `text` frame + a `done` frame (with
 * audio); non-streaming clients get the usual JSON (plus `audio` when stored).
 */
function serveCached(
  entry: {
    helpText: string;
    audioBase64: string | null;
    voice: string | null;
    source: string | null;
    sources: unknown;
  },
  stage: string,
  wantStream: boolean
): Response {
  const sources = Array.isArray(entry.sources) ? entry.sources : [];
  if (wantStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        send({ type: "text", chunk: entry.helpText });
        send({
          type: "done",
          stage,
          help: entry.helpText,
          source: entry.source || "ai",
          sources,
          audio: entry.audioBase64 || null,
          voice: entry.voice || null,
          cached: true,
        });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }
  return apiSuccess({
    stage,
    help: entry.helpText,
    source: entry.source || "ai",
    sources,
    audio: entry.audioBase64 || null,
    voice: entry.voice || null,
    cached: true,
  });
}

/**
 * Persist a freshly generated help answer (text) and, best-effort, its audio,
 * so the next student gets both instantly. Audio is synthesized here (once)
 * and stored. Never throws — caching is best-effort.
 */
async function persistHelp(
  kind: string,
  itemId: string,
  stage: string,
  helpText: string,
  source: string,
  sources: HelpSource[]
): Promise<void> {
  if (!itemId || !helpText) return;
  try {
    // Synthesize the voice once so later students skip the TTS call too.
    const tts = await synthesizeSpeech(helpText).catch(() => null);
    await prisma.lessonHelpCache.upsert({
      where: { kind_itemId_stage: { kind, itemId, stage } },
      create: {
        kind,
        itemId,
        stage,
        helpText,
        audioBase64: tts?.audio ?? null,
        voice: tts?.voice ?? null,
        source,
        sources: sources as unknown as object,
      },
      update: {
        helpText,
        audioBase64: tts?.audio ?? null,
        voice: tts?.voice ?? null,
        source,
        sources: sources as unknown as object,
      },
    });
  } catch (e) {
    logger.warn("lesson-help", "cache_persist_failed", { error: (e as Error)?.message });
  }
}

// Streaming needs a dynamic, non-cached response (no static optimization or
// edge buffering) so SSE chunks reach the client as they are produced.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    // Opt-in streaming: when the client sends { stream: true } we return an
    // SSE stream (text chunks, then a final meta frame). Older/other clients
    // omit the flag and keep getting the plain JSON response unchanged.
    const wantStream: boolean = body?.stream === true;

    if (kind !== "quiz" && kind !== "exercise") {
      return apiError(400, "kind must be 'quiz' or 'exercise'.");
    }

    // The item this help is for (same id for every student).
    const itemId: string = (kind === "quiz" ? body?.quizId : body?.exerciseId) || "";
    if (!itemId) {
      return apiError(400, `${kind === "quiz" ? "quizId" : "exerciseId"} is required.`);
    }

    // ---- Read-through cache: if a previous student already generated this
    // (kind,itemId,stage), serve the stored text + audio INSTANTLY. No Gemini,
    // no RAG, no TTS. This is the whole point — only the first student waits.
    try {
      const hit = await prisma.lessonHelpCache.findUnique({
        where: { kind_itemId_stage: { kind, itemId, stage } },
      });
      if (hit && hit.helpText) {
        return serveCached(hit, stage, wantStream);
      }
    } catch (e) {
      // Cache lookup failed (e.g. table missing before migration) — just
      // generate live. Never block the student on a cache error.
      logger.warn("lesson-help", "cache_lookup_failed", { error: (e as Error)?.message });
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
    // Sources shown to the student: the document(s) the explanation drew from,
    // each with a name, a file URL to open, and a short "search for this"
    // snippet so the student can Ctrl+F it inside a large PDF.
    let sources: { name: string; fileUrl: string | null; snippet: string }[] = [];
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

        sources = await resolveSources(matches);
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
      prompt = `You are Codo, a warm, encouraging AI buddy for kids on the CodingKida learning app.
The child is working on a ${kind} about "${topicLabel}" and tapped "Help".

Give ONE small, friendly HINT that nudges them toward figuring it out THEMSELVES.
Rules:
- Reply in simple HINGLISH — everyday spoken Hindi (Devanagari) MIXED with common
  English words, the way Indian kids and teachers actually talk. Example style:
  "ye loop तब तक चलता है जब तक condition true है".
- Use EASY, common Hindi words only. Do NOT use hard/formal/literary Hindi
  (avoid words like कार्यक्रम, चर, पुनरावृत्ति, अनुक्रमणिका). Keep technical terms,
  programming keywords, and code in ENGLISH (loop, function, variable, array,
  pointer, program, etc.) — don't translate them to Hindi.
- If a Hindi word would be hard for a 10-year-old, use the simple English word instead.
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
      prompt = `You are Codo, a warm, encouraging AI buddy for kids on the CodingKida learning app.
The child is working on a ${kind} about "${topicLabel}" and asked to see the answer.

The CORRECT answer (ground truth — trust this completely) is:
${correctAnswerText || "(not available)"}

Write a short, friendly explanation for a child:
1. Clearly state the correct answer.
2. Explain WHY it is correct, in simple words, using ONLY the material/teacher note below when available. Do not invent facts.
3. Keep it short, warm, and encouraging (a couple of short sentences; one emoji is fine).
4. Reply in simple HINGLISH — everyday spoken Hindi (Devanagari) MIXED with common
   English words, the way Indian kids and teachers actually talk. Example style:
   "सही answer B है क्योंकि ye loop हर number को check करता है".
5. Use EASY, common Hindi words only. Do NOT use hard/formal/literary Hindi
   (avoid words like कार्यक्रम, चर, पुनरावृत्ति, अनुक्रमणिका). Keep technical terms,
   programming keywords, code, and option letters (A/B/C/D) in ENGLISH — don't
   translate them. If a Hindi word would be hard for a 10-year-old, use the
   simple English word instead.
${materialBlock}
QUESTION:
${questionText}

Your explanation:`;
    }

    // Metadata the client needs once the full answer is known.
    const sourceType = material ? "study_material" : storedExplanation ? "teacher_note" : "ai";
    const outSources = stage === "answer" && material ? sources : [];

    // ---- Streaming path (opt-in): forward text as Gemini produces it ------
    if (wantStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (obj: unknown) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          let full = "";
          try {
            for await (const piece of callGeminiStream(prompt, {
              temperature: 0.5,
              // Hindi (Devanagari) uses several tokens per character, so a low
              // cap truncates the answer mid-sentence. 1024 gives it room to
              // finish while still being a short, kid-friendly explanation.
              maxOutputTokens: 1024,
            })) {
              full += piece;
              send({ type: "text", chunk: piece });
            }
          } catch {
            // fall through — handled by the empty-check below
          }

          // Nothing streamed (model busy) — try a one-shot fallback so the
          // child is never left stuck.
          if (!full) {
            const oneShot = await callGemini(prompt, {
              temperature: 0.5,
              maxOutputTokens: 1024, // Hindi needs more tokens; avoid truncation
            });
            if (oneShot) {
              full = oneShot;
              send({ type: "text", chunk: oneShot });
            } else if (stage === "answer" && (correctAnswerText || storedExplanation)) {
              full =
                `The correct answer is: ${correctAnswerText}` +
                (storedExplanation ? `\n\nWhy: ${storedExplanation}` : "");
              send({ type: "text", chunk: full });
            }
          }

          // Final metadata frame: full text + source attribution.
          const doneSource = full ? sourceType : "stored";
          send({
            type: "done",
            stage,
            help: full,
            source: doneSource,
            sources: outSources,
          });
          controller.close();

          if (full) {
            logger.success("lesson-help", "help_streamed", {
              userId: user!.userId, kind, stage, usedMaterial: !!material,
            });
            // Persist text + synthesize/store audio so the NEXT student gets
            // this instantly. Runs after the stream closes; we stay inside
            // start() (awaited) so the serverless invocation isn't cut off.
            await persistHelp(kind, itemId, stage, full, doneSource, outSources);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // ---- Non-streaming path (unchanged shape for other clients) -----------
    // Hindi (Devanagari) uses several tokens per character; a low cap would cut
    // the answer short. 1024 lets it finish while staying brief.
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
      return apiError(429, "Codo is a little busy. Please try again in a moment.");
    }

    logger.success("lesson-help", "help_generated", {
      userId: user!.userId,
      kind,
      stage,
      usedMaterial: !!material,
    });

    // Persist text + synthesize/store audio so the next student is instant.
    await persistHelp(kind, itemId, stage, answer, sourceType, outSources);

    return apiSuccess({
      stage,
      help: answer,
      source: sourceType,
      // Only reveal document sources on the full answer (not the hint), and
      // only when the explanation actually came from study material.
      sources: outSources,
      // Include the audio we just synthesized so the client can play it
      // without a second /api/tts round-trip.
      audio: null,
      voice: null,
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}


