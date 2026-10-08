/**
 * Per-lesson Quiz + Exercise generator.
 *
 * This is the single-lesson counterpart to the bulk scripts
 * (scripts/generate-quizzes.ts, scripts/generate-exercises.ts). It generates
 * content for ONE lesson at a time so it can run automatically when an admin
 * saves a lesson (via the lesson pipeline). The Gemini call / retry / model
 * resolution / PDF-text / vision helpers are copied here on purpose — the
 * scripts are gitignored and not deployed, so this lib cannot import from them.
 *
 * Content-source rules (STRICT):
 *   EXERCISE → module's PRACTICE WORKSHEET pdf (title/url ~ worksheet|practice|
 *              exercise|assignment|problem). Fallback: module NOTES pdf. If
 *              neither exists → SKIPPED (not a failure).
 *   QUIZ     → module's QUIZ pdf (title/url contains "quiz"). Fallback: module
 *              PPT pdf ("ppt"), then module NOTES pdf. If none → SKIPPED.
 *   Both may additionally fall back to the lesson's own notes PDF when sensible.
 *
 * Image/scanned PDFs with no text layer are read via Gemini VISION (inline
 * base64 <=15MB, else Files API upload) exactly like the scripts.
 */
import { prisma } from "@/app/lib/prisma";
import { s3 } from "@/app/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@/app/lib/logger";

const BUCKET = process.env.AWS_S3_BUCKET_NAME!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const QUIZ_COUNT = 5;
const EXERCISE_COUNT = 5;

// Preferred models, in order. Trimmed to the ones the key actually supports at
// runtime (resolveModels), so a deprecated/renamed model can't cause 404s.
let MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];
let modelsResolved = false;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Types (mirror the script shapes) ─────────────────────────────────────────
interface GeneratedQuiz {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}
interface GeneratedTestCase {
  input: string;
  expectedOutput: string;
}
interface GeneratedExercise {
  title: string;
  description: string;
  difficulty?: string;
  language?: string;
  starterCode?: string;
  solution?: string;
  testCases?: GeneratedTestCase[];
}

// ── S3 helpers (mirror app/lib/s3.ts + the scripts) ──────────────────────────
function getS3KeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.href.indexOf(".amazonaws.com/") === -1) return null;
    return decodeURIComponent(parsed.pathname.substring(1));
  } catch {
    return null;
  }
}
async function signUrl(url: string): Promise<string> {
  const key = getS3KeyFromUrl(url);
  if (!key) return url;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 600 });
}
async function extractPdfText(fileUrl: string): Promise<string> {
  try {
    const signed = getS3KeyFromUrl(fileUrl) ? await signUrl(fileUrl) : fileUrl;
    const res = await fetch(signed);
    if (!res.ok) return "";
    const buffer = Buffer.from(await res.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdf = require("pdf-parse");
    const data = await pdf(buffer);
    return (data.text || "").trim();
  } catch {
    return "";
  }
}
async function downloadPdfBuffer(fileUrl: string): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const signed = getS3KeyFromUrl(fileUrl) ? await signUrl(fileUrl) : fileUrl;
      const res = await fetch(signed);
      if (!res.ok) { await sleep(attempt * 1500); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf || buf.length === 0) { await sleep(attempt * 1500); continue; }
      return buf;
    } catch {
      await sleep(attempt * 1500);
    }
  }
  return null;
}
async function uploadPdfToGemini(buffer: Buffer): Promise<{ uri: string; mimeType: string } | null> {
  try {
    const startRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(buffer.length),
          "X-Goog-Upload-Header-Content-Type": "application/pdf",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: { display_name: "lesson-material.pdf" } }),
      }
    );
    const uploadUrl = startRes.headers.get("x-goog-upload-url");
    if (!uploadUrl) return null;
    const upRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        "Content-Type": "application/pdf",
      },
      body: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) as unknown as BodyInit,
    });
    if (!upRes.ok) return null;
    const data = await upRes.json();
    const uri = data?.file?.uri;
    const state = data?.file?.state;
    if (!uri) return null;
    if (state && state !== "ACTIVE") await sleep(2000);
    return { uri, mimeType: "application/pdf" };
  } catch {
    return null;
  }
}

// ── Gemini (mirror the scripts) ──────────────────────────────────────────────
function extractJsonObject(text: string): string {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

let lastError = "";

async function resolveModels(): Promise<void> {
  if (modelsResolved) return;
  modelsResolved = true; // resolve at most once per process
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}&pageSize=100`
    );
    if (!res.ok) return;
    const data = await res.json();
    const available: string[] = (data.models || [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m: { name?: string }) => String(m.name || "").replace(/^models\//, ""));
    if (available.length === 0) return;
    const preferredWorking = MODEL_CHAIN.filter((m) => available.includes(m));
    const extraFlash = available.filter(
      (m) => /flash/i.test(m) && !/vision|thinking|exp|preview/i.test(m) && !preferredWorking.includes(m)
    );
    const chain = [...preferredWorking, ...extraFlash];
    if (chain.length > 0) MODEL_CHAIN = chain;
  } catch {
    /* keep defaults */
  }
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

async function callGeminiPartsJSON<T>(parts: GeminiPart[], maxOutputTokens = 8192): Promise<T | null> {
  lastError = "";
  if (!GEMINI_API_KEY) { lastError = "GEMINI_API_KEY not set"; return null; }
  for (const model of MODEL_CHAIN) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 180_000);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.6, maxOutputTokens, responseMimeType: "application/json" },
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const cand = data.candidates?.[0];
          const text = cand?.content?.parts?.[0]?.text || "";
          const finish = cand?.finishReason || "";
          if (!text) {
            lastError = `empty response (finishReason=${finish || "unknown"}) [${model}]`;
            await sleep(attempt * 1500);
            continue;
          }
          try {
            return JSON.parse(extractJsonObject(text)) as T;
          } catch {
            lastError = `JSON parse failed (finishReason=${finish || "ok"}) [${model}]`;
            await sleep(attempt * 1500);
            continue;
          }
        } else if (res.status === 429) {
          lastError = `rate limited (429) [${model}]`;
          await sleep(attempt * 4000);
          continue;
        } else if (res.status === 503 || res.status === 500) {
          lastError = `model unavailable (${res.status}) [${model}]`;
          break;
        } else {
          lastError = `HTTP ${res.status} [${model}]`;
          break;
        }
      } catch (e) {
        clearTimeout(timer);
        lastError = `${(e as Error)?.name === "AbortError" ? "timeout" : "network error"} [${model}]`;
        if (attempt < 3) { await sleep(attempt * 2000); continue; }
        break;
      }
    }
  }
  return null;
}

// ── Material matchers (mirror the scripts) ───────────────────────────────────
function isWorksheetMaterial(title?: string, fileUrl?: string): boolean {
  const hay = `${title || ""} ${fileUrl || ""}`.toLowerCase();
  return /worksheet|practice|exercise|assignment|problem/.test(hay);
}
function isNotesMaterial(title?: string, fileUrl?: string): boolean {
  const hay = `${title || ""} ${fileUrl || ""}`.toLowerCase();
  return /note/.test(hay);
}
function isQuizMaterial(title?: string, fileUrl?: string): boolean {
  const hay = `${title || ""} ${fileUrl || ""}`.toLowerCase();
  return /quiz/.test(hay);
}
function isPptMaterial(title?: string, fileUrl?: string): boolean {
  const hay = `${title || ""} ${fileUrl || ""}`.toLowerCase();
  return /ppt/.test(hay);
}

// Language inference from the COURSE title (mirror generate-exercises.ts).
function inferLanguage(courseTitle: string): string {
  const override = (process.env.LANGUAGE || "").toLowerCase().trim();
  if (override) return override;
  const t = ` ${(courseTitle || "").toLowerCase()} `;
  if (/javascript|\bjs\b|node|react|web/.test(t)) return "javascript";
  if (/python|\bpy\b/.test(t)) return "python";
  if (/\bjava\b/.test(t)) return "java";
  if (/c\+\+|\bcpp\b/.test(t)) return "cpp";
  if (/\bc\b/.test(t) || /c programming|c language/.test(t)) return "c";
  return "python";
}

function normDifficulty(d?: string): string {
  const v = (d || "").toLowerCase();
  return v === "easy" || v === "medium" || v === "hard" ? v : "easy";
}

// A content "source": either extracted text, or a PDF to read with vision.
interface ContentSource {
  text: string;
  label: string;
  pdfUrl?: string; // vision fallback (image/scanned PDF)
}

type MaterialRow = { title: string | null; fileUrl: string | null; fileType: string | null };

/**
 * Resolve a content source from an ordered list of candidate PDFs. Tries text
 * extraction first; if a candidate is a PDF with no text layer, remembers it as
 * the vision fallback. Returns null when no usable PDF candidate exists.
 */
async function resolveContentSource(
  candidates: MaterialRow[],
  lessonNotesUrl: string | null,
): Promise<ContentSource | null> {
  let firstPdfUrl: string | undefined;
  const tryList: MaterialRow[] = [...candidates];
  // Lesson's own notes PDF is an additional fallback at the end.
  if (lessonNotesUrl && getS3KeyFromUrl(lessonNotesUrl)) {
    tryList.push({ title: "lesson notes", fileUrl: lessonNotesUrl, fileType: "pdf" });
  }

  for (const mat of tryList) {
    if (!mat.fileUrl) continue;
    const looksPdf = /\.pdf(\?|$)/i.test(mat.fileUrl) || mat.fileType === "pdf";
    if (!looksPdf) continue;
    if (!firstPdfUrl) firstPdfUrl = mat.fileUrl;
    const t = await extractPdfText(mat.fileUrl);
    if (t && t.length > 40) return { text: t, label: `"${mat.title || "material"}"` };
  }
  if (firstPdfUrl) return { text: "", label: "vision (image PDF)", pdfUrl: firstPdfUrl };
  return null;
}

// Build a Gemini PDF part (inline for small, Files API for large). Null = fail.
async function buildPdfPart(pdfUrl: string): Promise<GeminiPart | null> {
  const buf = await downloadPdfBuffer(pdfUrl);
  if (!buf) return null;
  const sizeMB = buf.length / (1024 * 1024);
  if (sizeMB <= 15) {
    return { inlineData: { mimeType: "application/pdf", data: buf.toString("base64") } };
  }
  const uploaded = await uploadPdfToGemini(buf);
  if (!uploaded) return null;
  return { fileData: { mimeType: uploaded.mimeType, fileUri: uploaded.uri } };
}

// Common lesson lookup used by both generators.
async function loadLesson(lessonId: string) {
  return prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      notes: true,
      moduleId: true,
      _count: { select: { quizzes: true, exercises: true } },
      module: {
        select: {
          id: true,
          title: true,
          course: { select: { title: true } },
        },
      },
    },
  });
}

async function loadModuleMaterials(moduleId: string): Promise<MaterialRow[]> {
  return prisma.moduleMaterial.findMany({
    where: { moduleId },
    select: { title: true, fileUrl: true, fileType: true },
  });
}

// ═══════════════════════════════════════════════════════
// QUIZ GENERATION (ONE lesson)
// ═══════════════════════════════════════════════════════

export async function generateLessonQuiz(
  lessonId: string,
  opts: { overwrite?: boolean } = {},
): Promise<{ ok: boolean; skipped?: boolean; count?: number; error?: string }> {
  try {
    if (!GEMINI_API_KEY) return { ok: false, error: "GEMINI_API_KEY not set" };
    const lesson = await loadLesson(lessonId);
    if (!lesson) return { ok: false, error: "lesson not found" };

    const overwrite = opts.overwrite === true;
    if (!overwrite && lesson._count.quizzes > 0) return { ok: true, skipped: true };

    const materials = await loadModuleMaterials(lesson.moduleId);
    // QUIZ priority: quiz pdf → ppt pdf → notes pdf → anything else.
    const ordered: MaterialRow[] = [
      ...materials.filter((m) => isQuizMaterial(m.title ?? undefined, m.fileUrl ?? undefined)),
      ...materials.filter((m) => isPptMaterial(m.title ?? undefined, m.fileUrl ?? undefined) && !isQuizMaterial(m.title ?? undefined, m.fileUrl ?? undefined)),
      ...materials.filter((m) => isNotesMaterial(m.title ?? undefined, m.fileUrl ?? undefined) && !isQuizMaterial(m.title ?? undefined, m.fileUrl ?? undefined) && !isPptMaterial(m.title ?? undefined, m.fileUrl ?? undefined)),
    ];

    const source = await resolveContentSource(ordered, lesson.notes || null);
    if (!source) return { ok: true, skipped: true }; // no quiz/ppt/notes pdf → skip

    await resolveModels();

    let pdfPart: GeminiPart | undefined;
    if (source.pdfUrl) {
      const part = await buildPdfPart(source.pdfUrl);
      if (part) pdfPart = part;
      else return { ok: true, skipped: true }; // could not read the only PDF → skip
    }

    const quizzes = await generateQuizViaGemini(lesson.title, lesson.module?.title || "", source.text, pdfPart);
    if (!quizzes || quizzes.length === 0) {
      return { ok: false, error: lastError || "no quizzes generated" };
    }

    if (overwrite && lesson._count.quizzes > 0) {
      await prisma.quiz.deleteMany({ where: { lessonId } });
    }
    const count = await saveQuizzes(lessonId, quizzes);
    logger.success("lesson-content", "quiz_ready", { lessonId, count });
    return { ok: true, count };
  } catch (err) {
    const msg = (err as Error)?.message || "unknown error";
    logger.warn("lesson-content", "quiz_failed", { lessonId, error: msg });
    return { ok: false, error: msg };
  }
}

async function generateQuizViaGemini(
  lessonTitle: string,
  moduleTitle: string,
  materialText: string,
  pdfPart?: GeminiPart,
): Promise<GeneratedQuiz[] | null> {
  const truncated = (materialText || "").substring(0, 20000);
  const materialBlock = pdfPart
    ? `The STUDY MATERIAL is the attached PDF document (slides/notes). Read it directly.`
    : `STUDY MATERIAL:\n${truncated || `Lesson "${lessonTitle}" in module "${moduleTitle}". Use general knowledge of the topic.`}`;

  const prompt = `You are an expert educator. Write exactly ${QUIZ_COUNT} multiple-choice questions about the lesson "${lessonTitle}" (module "${moduleTitle}"). Base the questions on the lesson's topic as covered by the material below.

${materialBlock}

Respond ONLY with valid JSON in this exact shape (no markdown, no prose):
{
  "quizzes": [
    { "question": "...", "options": ["A","B","C","D"], "answer": 0, "explanation": "..." }
  ]
}

Rules:
- Exactly ${QUIZ_COUNT} quizzes.
- Each question has exactly 4 options; "answer" is the 0-based index of the correct option.
- Questions must be about THIS lesson's topic only.
- If the material doesn't clearly cover the lesson, still create ${QUIZ_COUNT} sensible questions from the lesson title and general knowledge.
- Test understanding, not rote memorization.`;

  const parts: GeminiPart[] = pdfPart ? [pdfPart, { text: prompt }] : [{ text: prompt }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ai = await callGeminiPartsJSON<{ quizzes: GeneratedQuiz[] }>(parts);
    if (ai && Array.isArray(ai.quizzes) && ai.quizzes.length > 0) return ai.quizzes;
    await sleep(attempt * 2000);
  }
  return null;
}

async function saveQuizzes(lessonId: string, quizzes: GeneratedQuiz[]): Promise<number> {
  const last = await prisma.quiz.findFirst({
    where: { lessonId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let order = last?.order ?? 0;
  let created = 0;
  for (const q of quizzes) {
    if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || q.answer === undefined) continue;
    order++;
    await prisma.quiz.create({
      data: {
        lessonId,
        question: q.question,
        options: JSON.parse(JSON.stringify(q.options)),
        answer: Number(q.answer) || 0,
        explanation: q.explanation || null,
        order,
      },
    });
    created++;
  }
  return created;
}

// ═══════════════════════════════════════════════════════
// EXERCISE GENERATION (ONE lesson)
// ═══════════════════════════════════════════════════════

export async function generateLessonExercise(
  lessonId: string,
  opts: { overwrite?: boolean } = {},
): Promise<{ ok: boolean; skipped?: boolean; count?: number; error?: string }> {
  try {
    if (!GEMINI_API_KEY) return { ok: false, error: "GEMINI_API_KEY not set" };
    const lesson = await loadLesson(lessonId);
    if (!lesson) return { ok: false, error: "lesson not found" };

    const overwrite = opts.overwrite === true;
    if (!overwrite && lesson._count.exercises > 0) return { ok: true, skipped: true };

    const materials = await loadModuleMaterials(lesson.moduleId);
    // EXERCISE priority: worksheet pdf → notes pdf. If neither → skip.
    const ordered: MaterialRow[] = [
      ...materials.filter((m) => isWorksheetMaterial(m.title ?? undefined, m.fileUrl ?? undefined)),
      ...materials.filter((m) => isNotesMaterial(m.title ?? undefined, m.fileUrl ?? undefined) && !isWorksheetMaterial(m.title ?? undefined, m.fileUrl ?? undefined)),
    ];

    const source = await resolveContentSource(ordered, lesson.notes || null);
    if (!source) return { ok: true, skipped: true }; // no worksheet/notes pdf → skip

    await resolveModels();

    let pdfPart: GeminiPart | undefined;
    if (source.pdfUrl) {
      const part = await buildPdfPart(source.pdfUrl);
      if (part) pdfPart = part;
      else return { ok: true, skipped: true };
    }

    const language = inferLanguage(lesson.module?.course?.title || lesson.module?.title || "");
    const exercises = await generateExerciseViaGemini(lesson.title, lesson.module?.title || "", source.text, language, pdfPart);
    if (!exercises || exercises.length === 0) {
      return { ok: false, error: lastError || "no exercises generated" };
    }

    if (overwrite && lesson._count.exercises > 0) {
      await prisma.exercise.deleteMany({ where: { lessonId } });
    }
    const count = await saveExercises(lessonId, exercises, language);
    if (count === 0) return { ok: false, error: "parsed response but 0 runnable exercises (missing test cases)" };
    logger.success("lesson-content", "exercise_ready", { lessonId, count });
    return { ok: true, count };
  } catch (err) {
    const msg = (err as Error)?.message || "unknown error";
    logger.warn("lesson-content", "exercise_failed", { lessonId, error: msg });
    return { ok: false, error: msg };
  }
}

async function generateExerciseViaGemini(
  lessonTitle: string,
  moduleTitle: string,
  materialText: string,
  language: string,
  pdfPart?: GeminiPart,
): Promise<GeneratedExercise[] | null> {
  const truncated = (materialText || "").substring(0, 20000);
  const materialBlock = pdfPart
    ? `The PRACTICE MATERIAL is the attached PDF document (worksheet/notes). Read it directly.`
    : `PRACTICE MATERIAL:\n${truncated || `Practice worksheet for lesson "${lessonTitle}" in module "${moduleTitle}".`}`;

  const prompt = `You are an expert programming educator. Create exactly ${EXERCISE_COUNT} SIMPLE CODING PROGRAMS that a beginner can solve in an online code editor, for the lesson "${lessonTitle}" (module "${moduleTitle}").

Programming language for ALL programs: ${language}.

${materialBlock}

Each program MUST:
- Read its input from STANDARD INPUT (stdin) and print the answer to STANDARD OUTPUT (stdout).
- Be SIMPLE and directly based on the lesson's topic/content.
- Come with EXACTLY 3 test cases: each has "input" as RAW stdin text and "expectedOutput" as the EXACT text the correct program prints (trimmed).
- Include a working "solution" in ${language} that, given each test "input" on stdin, prints exactly the matching "expectedOutput".
- Include "starterCode" in ${language}: a minimal skeleton (with a TODO) the student completes.

Respond ONLY with valid JSON in this exact shape (no markdown, no prose):
{
  "exercises": [
    {
      "title": "Sum of Two Numbers",
      "description": "Read two integers from input and print their sum.",
      "difficulty": "easy",
      "language": "${language}",
      "starterCode": "…minimal ${language} skeleton with a TODO…",
      "solution": "…full working ${language} program that reads stdin and prints the answer…",
      "testCases": [
        { "input": "5 10", "expectedOutput": "15" },
        { "input": "0 0", "expectedOutput": "0" },
        { "input": "-3 7", "expectedOutput": "4" }
      ]
    }
  ]
}

Rules:
- Exactly ${EXERCISE_COUNT} programs, each with EXACTLY 3 test cases.
- Keep programs beginner-friendly and short; prefer plain stdin/stdout (no fancy libraries).
- input must be RAW STDIN (e.g. "5 10" or a line of text), NOT "a=5, b=10".
- expectedOutput must be EXACTLY what the solution prints for that input (mind spacing/newlines; keep it single-line where possible).
- Programs must be about THIS lesson's topic only.
- If the material doesn't clearly cover the lesson, still create ${EXERCISE_COUNT} sensible simple programs from the lesson title.`;

  const parts: GeminiPart[] = pdfPart ? [pdfPart, { text: prompt }] : [{ text: prompt }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ai = await callGeminiPartsJSON<{ exercises: GeneratedExercise[] }>(parts);
    if (ai && Array.isArray(ai.exercises) && ai.exercises.length > 0) return ai.exercises;
    await sleep(attempt * 2000);
  }
  return null;
}

async function saveExercises(
  lessonId: string,
  exercises: GeneratedExercise[],
  language: string,
): Promise<number> {
  const last = await prisma.exercise.findFirst({
    where: { lessonId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let order = last?.order ?? 0;
  let created = 0;
  for (const ex of exercises) {
    if (!ex.title || !ex.description) continue;
    const tcs = (ex.testCases || []).filter(
      (t) => t && typeof t.input === "string" && typeof t.expectedOutput === "string"
    );
    if (tcs.length === 0) continue; // not runnable without test cases
    order++;
    const lang = ex.language || language;
    const bestSolution =
      ex.solution && ex.solution.trim() ? { [lang]: { code: ex.solution.trim() } } : undefined;
    const exercise = await prisma.exercise.create({
      data: {
        lessonId,
        title: ex.title,
        description: ex.description,
        difficulty: normDifficulty(ex.difficulty),
        type: "coding",
        language: lang,
        starterCode: ex.starterCode || null,
        solution: ex.solution || null,
        ...(bestSolution ? { bestSolution: JSON.parse(JSON.stringify(bestSolution)) } : {}),
        order,
      },
    });
    for (let i = 0; i < Math.min(tcs.length, 3); i++) {
      await prisma.testCase.create({
        data: {
          exerciseId: exercise.id,
          input: tcs[i].input,
          expectedOutput: tcs[i].expectedOutput,
          isHidden: i >= 1,
          order: i + 1,
        },
      });
    }
    created++;
  }
  return created;
}
