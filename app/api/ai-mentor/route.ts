import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";
import { logger } from "@/app/lib/logger";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * POST /api/ai-mentor
 * Server-side AI mentor — context-aware, secure, scalable
 * Body: { question, lessonId (optional), mode: "lesson" | "general" }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, message: "AI service not configured." },
        { status: 503 }
      );
    }

    const payload = verifyToken(token);
    const { question, lessonId, mode } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json(
        { success: false, message: "Question is required." },
        { status: 400 }
      );
    }

    // Build context based on mode
    let systemPrompt = "";

    if (mode === "lesson" && lessonId) {
      // Lesson-specific AI mentor — fetch lesson + notes content
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { module: { select: { title: true, course: { select: { title: true } } } } },
      });

      let notesText = "";
      if (lesson?.notes && getS3KeyFromUrl(lesson.notes)) {
        try {
          const signedUrl = await getSignedFileUrlFromUrl(lesson.notes, 300);
          const pdfRes = await fetch(signedUrl);
          if (pdfRes.ok) {
            const buffer = Buffer.from(await pdfRes.arrayBuffer());
            try {
              const pdf = require("pdf-parse");
              const pdfData = await pdf(buffer);
              notesText = pdfData.text?.substring(0, 5000) || "";
            } catch {}
          }
        } catch {}
      }

      const lessonTitle = lesson?.title || "Unknown";
      const moduleTitle = lesson?.module?.title || "";
      const courseTitle = lesson?.module?.course?.title || "";

      systemPrompt = `You are an expert AI coding mentor for CodingKeda EdTech platform.

CONTEXT:
- Course: "${courseTitle}"
- Module: "${moduleTitle}"
- Lesson: "${lessonTitle}"
${notesText ? `- Lesson Notes Content:\n${notesText}\n` : ""}

INSTRUCTIONS:
1. LANGUAGE: Reply in the SAME language the student uses. English question = English answer. Hinglish = Hinglish. Never default to pure Hindi.
2. Give DIRECT, ACCURATE, and COMPLETE answers with working code examples.
3. If the question relates to the lesson content above, use that context to give specific answers.
4. Include properly formatted code blocks with language specified.
5. Keep answers clear, well-structured, and technically correct.
6. Be concise but thorough — cover the topic completely.
7. If asked for code, give COMPLETE working code, not partial snippets.

Student's question: ${question.trim()}`;

    } else {
      // General AI assistant (dashboard)
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { name: true },
      });

      systemPrompt = `You are an expert AI coding mentor for CodingKeda EdTech platform.

STUDENT: ${user?.name || "Student"}

INSTRUCTIONS:
1. LANGUAGE: Reply in the SAME language the student uses. English question = English answer. Hinglish = Hinglish. Never default to pure Hindi.
2. Give DIRECT, ACCURATE, and COMPLETE answers with working code examples.
3. Help with any programming language, concept, or career guidance.
4. Include properly formatted code blocks with language specified.
5. Keep answers clear, well-structured, and technically correct.
6. If asked for code, give COMPLETE working code, not partial snippets.
7. Be encouraging and professional.

Student's question: ${question.trim()}`;
    }

    // Call Gemini API with retry
    let answer = "";
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (answer) break;
        } else if (res.status === 429) {
          // Rate limited — wait and retry
          await new Promise(r => setTimeout(r, attempts * 3000));
          continue;
        } else {
          break;
        }
      } catch {
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }
    }

    if (!answer) {
      logger.warn("ai-mentor", "all_retries_failed", { userId: payload.userId, attempts: maxAttempts, mode });
      return NextResponse.json({
        success: false,
        message: "AI is currently busy. Please wait a few seconds and try again.",
      }, { status: 429 });
    }

    logger.success("ai-mentor", "response_generated", { userId: payload.userId, mode, answerLength: answer.length });

    return NextResponse.json({
      success: true,
      answer,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
