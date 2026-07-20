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

      systemPrompt = `You are an expert AI coding mentor for CodingKida EdTech platform.

CONTEXT:
- Course: "${courseTitle}"
- Module: "${moduleTitle}"
- Lesson: "${lessonTitle}"
${notesText ? `- Lesson Notes Content:\n${notesText}\n` : ""}

INSTRUCTIONS:
1. LANGUAGE: Reply in the SAME language the student uses. English question = English answer. Hinglish = Hinglish. Never default to pure Hindi.
2. STRICTLY answer ONLY questions related to this specific lesson's content, topic, or subject matter. Do NOT answer general knowledge, off-topic, or unrelated questions.
3. If the student asks anything NOT related to this lesson, reply EXACTLY with: "Sorry: I give answer only related to this specific lesson. To know the answer of this question, go and ask with Dashboard AI Mentor."
4. Give DIRECT, ACCURATE, and COMPLETE answers with working code examples when the question is related to the lesson.
5. Include properly formatted code blocks with language specified.
6. Keep answers clear, well-structured, and technically correct.
7. Be concise but thorough — cover the topic completely.
8. If asked for code related to the lesson topic, give COMPLETE working code, not partial snippets.

Student's question: ${question.trim()}`;

    } else {
      // General AI assistant (dashboard)
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { name: true },
      });

      systemPrompt = `You are an expert AI mentor for CodingKida EdTech platform — an educational app for students.

STUDENT: ${user?.name || "Student"}

ALLOWED TOPICS (answer ONLY these):
- Programming & Coding (all languages: C, Java, Python, JavaScript, etc.)
- Computer Science, Data Structures, Algorithms
- Artificial Intelligence, Machine Learning, Deep Learning
- Engineering subjects (all branches)
- Science (Physics, Chemistry, Biology, Mathematics)
- Arts & Commerce (Economics, Accounting, History, Geography, Literature)
- Career guidance, skill development, interview preparation
- Education & study tips, exam preparation
- Sports & fitness (for kids — cricket, football, chess, etc.)
- Cartoons, animation, creative arts (for kids)
- CodingKida app features, courses, and platform-related questions
- General knowledge that helps academic/career growth

STRICTLY BLOCKED TOPICS (NEVER answer these):
- Politics, political parties, elections, government criticism
- Crime, violence, weapons, illegal activities
- Adult content, inappropriate or vulgar language
- Religious debates, hate speech, discrimination
- Nonsense talk, time-waste conversations, gossip
- Any harmful, dangerous, or unethical content

If student asks about a BLOCKED topic, reply EXACTLY with:
"Sorry: This topic is not allowed. I am here to help you with education, coding, career, and learning-related questions only!"

INSTRUCTIONS:
1. LANGUAGE: Reply in the SAME language the student uses. English = English. Hinglish = Hinglish.
2. Give DIRECT, ACCURATE, and COMPLETE answers with working code examples.
3. Help with programming, academics, career guidance, and knowledge building.
4. Include properly formatted code blocks with language specified.
5. Keep answers clear, well-structured, and technically correct.
6. If asked for code, give COMPLETE working code, not partial snippets.
7. Be encouraging, professional, and student-friendly.

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
