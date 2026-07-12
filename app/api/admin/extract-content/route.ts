import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/middleware";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * POST /api/admin/extract-content
 * 
 * Receives a PDF file + type (quiz/exercise).
 * Extracts text from PDF, sends to Gemini for structured quiz/exercise generation.
 * Returns quizzes OR exercises based on type.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded." },
        { status: 400 }
      );
    }

    if (!type || (type !== "quiz" && type !== "exercise")) {
      return NextResponse.json(
        { success: false, message: "type must be 'quiz' or 'exercise'." },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, message: "Only .pdf files are supported." },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "PDF file too large. Maximum 10MB allowed." },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, message: "AI service not configured (missing API key)." },
        { status: 500 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text from PDF using pdf-parse v2.x
    let pdfText = "";
    try {
      const pdfParse = eval('require')('pdf-parse');
      const parser = new pdfParse.PDFParse({ verbosity: 0, data: buffer });
      const result = await parser.getText();
      pdfText = result.text?.trim() || "";
    } catch (pdfErr: any) {
      console.error("PDF text extraction failed:", pdfErr?.message);
      // If text extraction fails, we'll send PDF as base64 to Gemini
      pdfText = "";
    }

    // Decide strategy: text-based (cheaper) or PDF-direct (more reliable but uses more tokens)
    let result;
    if (pdfText && pdfText.length >= 50) {
      // Text extracted successfully — send text to Gemini (saves tokens)
      result = await callGeminiWithText(pdfText, type);
    } else {
      // Text extraction failed or too short — send PDF directly as base64
      const base64Pdf = buffer.toString("base64");
      result = await callGeminiWithPdf(base64Pdf, type);
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error || "AI could not process the content. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: type === "quiz"
        ? `Extracted ${result.quizzes.length} quiz(zes).`
        : `Extracted ${result.exercises.length} exercise(s).`,
      quizzes: result.quizzes,
      exercises: result.exercises,
    });
  } catch (err) {
    console.error("Extract content error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

// ─── Gemini call with extracted TEXT (cheaper, uses fewer tokens) ───
async function callGeminiWithText(
  text: string,
  type: "quiz" | "exercise"
): Promise<{ success: boolean; quizzes: any[]; exercises: any[]; error?: string }> {
  const truncated = text.length > 15000 ? text.slice(0, 15000) : text;
  const prompt = buildPrompt(type, truncated);

  return await sendToGemini([{ text: prompt }]);
}

// ─── Gemini call with PDF as inline_data (fallback, uses more tokens) ───
async function callGeminiWithPdf(
  base64Pdf: string,
  type: "quiz" | "exercise"
): Promise<{ success: boolean; quizzes: any[]; exercises: any[]; error?: string }> {
  const prompt = buildPrompt(type, null);

  return await sendToGemini([
    { inline_data: { mime_type: "application/pdf", data: base64Pdf } },
    { text: prompt },
  ]);
}

// ─── Build the prompt based on type ───
function buildPrompt(type: "quiz" | "exercise", pdfText: string | null): string {
  const contentSection = pdfText
    ? `\nPDF CONTENT:\n"""\n${pdfText}\n"""\n`
    : "";

  if (type === "quiz") {
    return `You are an expert educational content analyzer.${pdfText ? " Given the following text from a PDF," : " Analyze this PDF document and"} generate QUIZ QUESTIONS (MCQ) based on the actual subject matter content.
${contentSection}
RULES:
- Generate quiz questions that test understanding of the ACTUAL SUBJECT in the content (not about the PDF itself)
- Each quiz must have exactly 4 options, one correct answer (0-indexed), and a brief explanation
- Generate between 3 and 10 quizzes depending on how much content is available
- Difficulty should be appropriate to the content level

Respond ONLY with valid JSON (no markdown, no code blocks):
{"quizzes":[{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]}`;
  }

  return `You are an expert educational content analyzer.${pdfText ? " Given the following text from a PDF," : " Analyze this PDF document and"} generate EXERCISES based on the actual subject matter content.
${contentSection}
RULES:
- Generate exercises that test the ACTUAL SUBJECT in the content (not about the PDF itself)
- Determine if exercises should be "theory" or "coding" type based on content
- For THEORY: provide title, description (question), solution (correct answer), difficulty (easy/medium/hard)
- For CODING: provide title, description, difficulty, category, constraints, timeComplexity, spaceComplexity, language (default "c"), and testCases with input/expectedOutput (2 visible + 2 hidden)
- Generate between 2 and 5 exercises

Respond ONLY with valid JSON (no markdown, no code blocks):
{"exercises":[{"title":"...","description":"...","type":"theory","difficulty":"medium","solution":"...","category":"general","constraints":null,"timeComplexity":null,"spaceComplexity":null,"language":null,"testCases":[]}]}`;
}

// ─── Send request to Gemini API ───
async function sendToGemini(
  parts: any[]
): Promise<{ success: boolean; quizzes: any[]; exercises: any[]; error?: string }> {
  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`Gemini API error: ${res.status}`, errBody);

      if (res.status === 429) {
        return { success: false, quizzes: [], exercises: [], error: "AI rate limit reached. Please wait a minute and try again." };
      }
      if (res.status === 400) {
        return { success: false, quizzes: [], exercises: [], error: "PDF could not be processed by AI. Try a smaller or text-based PDF." };
      }
      return { success: false, quizzes: [], exercises: [], error: `AI service error (${res.status}). Try again later.` };
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];

    if (!candidate || candidate.finishReason === "SAFETY") {
      return { success: false, quizzes: [], exercises: [], error: "AI blocked the content or returned empty response." };
    }

    const rawText = candidate.content?.parts?.[0]?.text || "";
    if (!rawText) {
      return { success: false, quizzes: [], exercises: [], error: "AI returned empty response. Try again." };
    }

    // Clean markdown code blocks if present
    const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Gemini JSON parse failed. Raw:", rawText.slice(0, 300));
      return { success: false, quizzes: [], exercises: [], error: "AI response was not valid JSON. Try again." };
    }

    return {
      success: true,
      quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
      exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
    };
  } catch (err: any) {
    console.error("Gemini call failed:", err?.message || err);
    return { success: false, quizzes: [], exercises: [], error: "Failed to connect to AI service." };
  }
}
